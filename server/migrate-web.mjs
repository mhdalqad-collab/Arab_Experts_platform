import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { translateSql } from './database.mjs';

export const WEB_SCHEMA_VERSION = '0021_dapper_otto_octavius.sql';

export async function migrateWebDatabase(client) {
  const directory = new URL('../drizzle/', import.meta.url);
  const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(8761135)");
    await client.query('CREATE SCHEMA IF NOT EXISTS eim_web');
    await client.query('SET LOCAL search_path=eim_web');
    await client.query('CREATE TABLE IF NOT EXISTS web_schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of files) {
      const source = (await readFile(new URL(name, directory), 'utf8')).replace(/\r\n/g, '\n');
      const digest = createHash('sha256').update(source).digest('hex');
      const existing = await client.query('SELECT sha256 FROM web_schema_migrations WHERE name=$1', [name]);
      if (existing.rows[0]) {
        if (existing.rows[0].sha256 !== digest) throw new Error(`Changed applied migration: ${name}`);
        continue;
      }
      const deferredForeignKeys = [];
      // SQLite permits forward references within a migration; PostgreSQL requires
      // the referenced table to exist first. Add those constraints after its DDL.
      for (let statement of source.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) {
        const table = statement.match(/^CREATE TABLE `([^`]+)`/i)?.[1];
        if (table) {
          statement = statement.replace(/,?\s*FOREIGN KEY[^\n]+/g, (clause) => {
            deferredForeignKeys.push(`ALTER TABLE "${table}" ADD ${translateSql(clause.replace(/^,?\s*/, '').replace(/,\s*$/, ''))}`);
            return '';
          }).replace(/,\s*\)/g, '\n)');
        }
        statement = translateSql(statement).replace(/\binteger DEFAULT true\b/gi, 'integer DEFAULT 1').replace(/\binteger DEFAULT false\b/gi, 'integer DEFAULT 0');
        await client.query(statement);
      }
      for (const sql of deferredForeignKeys) await client.query(sql);
      await client.query('INSERT INTO web_schema_migrations (name,sha256) VALUES ($1,$2)', [name, digest]);
    }
    await client.query(`CREATE TABLE IF NOT EXISTS web_identities (
      issuer text NOT NULL, subject text NOT NULL, account_id text NOT NULL REFERENCES accounts(account_id),
      PRIMARY KEY (issuer, subject), UNIQUE(account_id))`);
    await client.query(`CREATE TABLE IF NOT EXISTS web_sessions (
      token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(account_id),
      expires_at timestamptz NOT NULL)`);
    await client.query('CREATE INDEX IF NOT EXISTS web_sessions_expiry ON web_sessions(expires_at)');
    await client.query(`CREATE TABLE IF NOT EXISTS web_auth_transactions (
      token_hash text PRIMARY KEY, state text NOT NULL, nonce text NOT NULL, verifier text NOT NULL,
      return_to text NOT NULL, expires_at timestamptz NOT NULL)`);
    await client.query('COMMIT');
    return { migrations: files.length, version: WEB_SCHEMA_VERSION };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
