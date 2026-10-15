import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { migrateWebDatabase } from '../server/migrate-web.mjs';
import { bindSql, createSqlDatabase } from '../server/database.mjs';
import { createSession, findSession, tokenHash } from '../server/auth.mjs';

let engine, pool, db, directory;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'arab-experts-db-test-'));
  engine = new PGlite(directory);
  await migrateWebDatabase(engine);
  await engine.query('SET search_path=eim_web');
  pool = { query: (...args) => engine.query(...args), connect: async () => ({ query: (...args) => engine.query(...args), release() {} }) };
  db = createSqlDatabase(pool);
});
after(async () => { await engine.close(); await rm(directory, { recursive: true, force: true }); });

test('all 22 migrations are recorded, reruns preserve data and changed migrations fail', async () => {
  const result = await engine.query('SELECT count(*) AS count FROM web_schema_migrations');
  assert.equal(Number(result.rows[0].count), 22);
  await migrateWebDatabase(engine);
  await engine.query("UPDATE web_schema_migrations SET sha256='changed' WHERE name=(SELECT min(name) FROM web_schema_migrations)");
  await assert.rejects(() => migrateWebDatabase(engine), /Changed applied migration/);
  // Restore the actual original checksum without depending on an archive filename.
  const { createHash } = await import('node:crypto');
  const name = (await engine.query('SELECT min(name) AS name FROM web_schema_migrations')).rows[0].name;
  const contents = (await readFile(new URL(`../drizzle/${name}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  await engine.query('UPDATE web_schema_migrations SET sha256=$1 WHERE name=$2', [createHash('sha256').update(contents).digest('hex'), name]);
});

test('bound SQL preserves literals, repeated arguments and sparse positions', () => {
  const result = bindSql("SELECT '?1' AS literal, ?3 AS a, ?3 AS b, ?1 AS c -- ?2", ['first', 'unused', "x'; DROP TABLE accounts;--"]);
  assert.equal(result.text, "SELECT '?1' AS literal, $1 AS a, $1 AS b, $2 AS c -- ?2");
  assert.deepEqual(result.values, ["x'; DROP TABLE accounts;--", 'first']);
  assert.deepEqual(bindSql('SELECT ?, ?', ['a','b']).values, ['a','b']);
  assert.throws(() => bindSql('SELECT ?2', ['a']), /binding missing/);
});

test('every non-interpolated web API SQL statement plans against PostgreSQL', async () => {
  let checked = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await visit(path); continue; }
      if (!path.endsWith('route.ts')) continue;
      const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const queries = [];
      function inspect(node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'prepare') {
          const argument = node.arguments[0];
          if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) queries.push(argument.text);
        }
        ts.forEachChild(node, inspect);
      }
      inspect(source);
      for (const sql of queries) {
        const slots = [...sql.matchAll(/\?(\d+)/g)].map(match => Number(match[1]));
        const query = bindSql(sql, Array(Math.max(0, ...slots)).fill(null));
        try { await engine.query(`EXPLAIN ${query.text}`, query.values); }
        catch (error) { throw new Error(`${path}: ${error.message}\n${query.text}`); }
        checked++;
      }
    }
  }
  await visit(fileURLToPath(new URL('../app/api/', import.meta.url)));
  assert.ok(checked > 150, `Only checked ${checked} queries`);
  console.log(`Planned ${checked} web API statements against PostgreSQL`);
});

test('sessions bind verified issuer/subject, reject takeover and survive database restart', async () => {
  const claims = { sub: 'person-1', email: 'member@example.test', email_verified: true, name: 'عضو الاختبار' };
  await assert.rejects(() => createSession(pool, 'https://issuer.test', { ...claims, email_verified: false }), /Verified/);
  const token = await createSession(pool, 'https://issuer.test', claims);
  assert.equal((await findSession(token, pool)).email, claims.email);
  await assert.rejects(() => createSession(pool, 'https://other-issuer.test', claims));
  await engine.close();
  engine = new PGlite(directory);
  await engine.query('SET search_path=eim_web');
  assert.equal((await findSession(token, pool)).displayName, claims.name);
  await engine.query("UPDATE web_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenHash(token)]);
  assert.equal(await findSession(token, pool), null);
  assert.equal(await findSession('forged-session', pool), null);
  const token2 = await createSession(pool, 'https://issuer.test', claims);
  await engine.query("UPDATE accounts SET status='SUSPENDED' WHERE email=$1", [claims.email]);
  assert.equal(await findSession(token2, pool), null);
  await assert.rejects(() => createSession(pool, 'https://issuer.test', claims), /unavailable/);
});

test('batch writes roll back together and parameterized user input is not SQL', async () => {
  const now = new Date().toISOString();
  const insert = (id, email) => db.prepare("INSERT INTO accounts(account_id,email,status,created_at,updated_at) VALUES(?1,?2,'ACTIVE',?3,?3)").bind(id, email, now);
  await assert.rejects(() => db.batch([insert('rollback-1','rollback@example.test'), insert('rollback-2','member@example.test')]));
  assert.equal(await db.prepare('SELECT * FROM accounts WHERE account_id=?1').bind('rollback-1').first(), null);
  const input = "'; DROP TABLE accounts; --";
  await insert('literal', input).run();
  assert.equal((await db.prepare('SELECT email FROM accounts WHERE account_id=?1').bind('literal').first()).email, input);
  await db.prepare("INSERT OR IGNORE INTO accounts(account_id,email,status,created_at,updated_at) VALUES(?1,?2,'ACTIVE',?3,?3)").bind('literal', input, now).run();
  assert.equal((await db.prepare('SELECT * FROM accounts WHERE account_id=?1').bind('literal').all()).results.length, 1);
});
