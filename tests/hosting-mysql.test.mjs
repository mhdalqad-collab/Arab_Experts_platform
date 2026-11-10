import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { createWebPool, createSqlDatabase, bindSql } from '../server/database.mjs';
import { migrateWebDatabase } from '../server/migrate-web.mjs';
import { createSession, findSession, tokenHash, consumeAuthTransaction } from '../server/auth.mjs';
import { mysqlQuery } from '../server/mysql.mjs';
import { createDatabaseStorage } from '../server/storage.mjs';

test('MySQL binding preserves quoted SQL, repeated values and table isolation', () => {
  const query = mysqlQuery("SELECT '$1 accounts' FROM accounts WHERE account_id=$2 OR email=$2 -- $1", ['unused', 'literal']);
  assert.equal(query.text, "SELECT '$1 accounts' FROM `eim_accounts` WHERE account_id=? OR email=? -- $1");
  assert.deepEqual(query.values, ['literal', 'literal']);
  assert.throws(() => mysqlQuery('SELECT $2', ['one']), /binding missing/);
});

test('real MySQL migration, API SQL, sessions, upserts and transaction isolation', { skip: process.env.HOSTING_TEST_MYSQL !== 'true', timeout: 120000 }, async () => {
  const pool = createWebPool({ ...process.env, WEB_DATABASE_DRIVER: 'mysql' });
  const client = await pool.connect();
  try {
    await migrateWebDatabase(client);
    await migrateWebDatabase(client);
    const db = createSqlDatabase(pool), id = randomUUID(), now = new Date().toISOString();
    const claims = { sub: id, email: `${id}@test.invalid`, email_verified: true, name: 'عضو اختبار' };
    await assert.rejects(() => createSession(pool, 'https://issuer.test', { ...claims, email_verified: false }));
    const token = await createSession(pool, 'https://issuer.test', claims);
    assert.equal((await findSession(token, pool)).email, claims.email);
    await assert.rejects(() => createSession(pool, 'https://other.test', claims));
    const account = await db.prepare('SELECT account_id FROM accounts WHERE email=?1').bind(claims.email).first();
    await db.prepare(`INSERT INTO accounts(account_id,email,display_name,status,created_at,updated_at)
      VALUES(?1,?2,?3,'ACTIVE',?4,?4) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name`)
      .bind(randomUUID(), claims.email, 'اسم محفوظ', now).run();
    assert.equal((await findSession(token,pool)).displayName, 'اسم محفوظ');
    await assert.rejects(() => db.prepare(`INSERT INTO accounts(account_id,email,status,created_at,updated_at)
      VALUES(?1,?2,'ACTIVE',?3,?3) ON CONFLICT(account_id) DO UPDATE SET email=excluded.email`)
      .bind(randomUUID(), claims.email, now).run());
    await assert.rejects(() => db.batch([
      db.prepare('UPDATE accounts SET display_name=?1 WHERE account_id=?2').bind('must rollback',account.account_id),
      db.prepare("INSERT INTO accounts(account_id,email,status,created_at,updated_at) VALUES(?1,?2,'ACTIVE',?3,?3)").bind(randomUUID(),claims.email,now),
    ]));
    assert.equal((await findSession(token,pool)).displayName,'اسم محفوظ');
    const flowHash = tokenHash(randomUUID());
    await pool.query("INSERT INTO web_auth_transactions(token_hash,state,nonce,verifier,return_to,expires_at) VALUES($1,'state','nonce','verifier','/',now()+interval '10 minutes')",[flowHash]);
    const results = await Promise.all([consumeAuthTransaction(pool,flowHash,'state'), consumeAuthTransaction(pool,flowHash,'state')]);
    assert.equal(results.reduce((sum,result)=>sum+result.rows.length,0),1);
    const store=createDatabaseStorage(pool), fileKey=`tests/${id}`, bytes=Buffer.alloc(700000,37);
    await store.put(fileKey,bytes);
    const stored=await store.get(fileKey);
    assert.deepEqual(Buffer.from(await new Response(stored.body).arrayBuffer()),bytes);
    await store.put(fileKey,Buffer.from('replacement'));
    assert.equal(await new Response((await store.get(fileKey)).body).text(),'replacement');
    await assert.rejects(()=>store.put(fileKey,Buffer.alloc(10*1024*1024+1)),/size/);
    await store.delete(fileKey); assert.equal(await store.get(fileKey),null);
    let count = 0;
    async function visit(directory) {
      for (const entry of await readdir(directory,{withFileTypes:true})) {
        const path=join(directory,entry.name);
        if(entry.isDirectory()) { await visit(path); continue; }
        if(!path.endsWith('route.ts')) continue;
        const ast=ts.createSourceFile(path,await readFile(path,'utf8'),ts.ScriptTarget.Latest,true), queries=[];
        function inspect(node) {
          if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='prepare') {
            const arg=node.arguments[0]; if(arg&&(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg))) queries.push(arg.text);
          }
          ts.forEachChild(node,inspect);
        }
        inspect(ast);
        for(const source of queries) {
          const sql=source.split(/\s+ON CONFLICT/i)[0];
          const slots=[...sql.matchAll(/\?(\d+)/g)].map(match=>Number(match[1]));
          const query=bindSql(sql,Array(Math.max(0,...slots)).fill(null));
          try { await pool.query(`EXPLAIN ${query.text.replace(/ ON CONFLICT DO NOTHING$/i,'')}`,query.values); }
          catch(error) { throw new Error(`${path}: ${error.message}\n${query.text}`); }
          count++;
        }
      }
    }
    await visit(new URL('../app/api/',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
    assert.ok(count>150); console.log(`Planned ${count} statements on MySQL`);
    await pool.query("UPDATE web_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(token)]);
    assert.equal(await findSession(token,pool),null);
  } finally { client.release(); await pool.end(); }
});
