import { createWebPool } from '../server/database.mjs';
import { migrateWebDatabase } from '../server/migrate-web.mjs';

const pool = createWebPool({ ...process.env, WEB_DATABASE_URL: process.env.WEB_DATABASE_MIGRATION_URL || process.env.WEB_DATABASE_URL });
if (!pool) throw new Error('Set WEB_DATABASE_MIGRATION_URL for the separate platform database');
const client = await pool.connect();
try { console.log(await migrateWebDatabase(client)); }
finally { client.release(); await pool.end(); }
