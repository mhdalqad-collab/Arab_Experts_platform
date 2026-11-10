import { createHash } from 'node:crypto';
import schema from './mysql-schema.json' with { type: 'json' };

const q = name => `\`${name}\``;
export function mysqlSchemaStatements() {
  const indexed = new Set();
  for (const table of schema) {
    for (const column of table.columns) if (column.pk) indexed.add(`${table.name}.${column.name}`);
    for (const index of table.indexes) for (const column of index.columns) indexed.add(`${table.name}.${column}`);
    for (const fk of table.foreignKeys) { indexed.add(`${table.name}.${fk.from}`); indexed.add(`${fk.table}.${fk.to}`); }
  }
  const statements = [], constraints = [];
  for (const table of schema) {
    const columns = table.columns.map(column => {
      const type = column.type.toLowerCase() === 'integer' ? 'INT' : indexed.has(`${table.name}.${column.name}`) ? 'VARCHAR(255)' : 'LONGTEXT';
      return `${q(column.name)} ${type}${column.notnull || column.pk ? ' NOT NULL' : ''}${column.default === null ? '' : ` DEFAULT (${column.default})`}`;
    });
    const primary = table.columns.filter(column => column.pk).sort((a,b) => a.pk-b.pk);
    if (primary.length) columns.push(`PRIMARY KEY (${primary.map(column => q(column.name)).join(',')})`);
    for (const index of table.indexes) columns.push(`${index.unique ? 'UNIQUE ' : ''}KEY ${q(index.name)} (${index.columns.map(q).join(',')})`);
    statements.push(`CREATE TABLE IF NOT EXISTS ${q('eim_'+table.name)} (${columns.join(',\n')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    for (const fk of table.foreignKeys) {
      const name = `eim_fk_${table.name}_${fk.id}`;
      constraints.push({ name, table: 'eim_'+table.name, sql: `ALTER TABLE ${q('eim_'+table.name)} ADD CONSTRAINT ${q(name)} FOREIGN KEY (${q(fk.from)}) REFERENCES ${q('eim_'+fk.table)} (${q(fk.to)}) ON DELETE ${fk.on_delete} ON UPDATE ${fk.on_update}` });
    }
  }
  statements.push(
    'CREATE TABLE IF NOT EXISTS eim_web_identities (issuer VARCHAR(255) NOT NULL, subject VARCHAR(255) NOT NULL, account_id VARCHAR(255) NOT NULL, PRIMARY KEY(issuer,subject), UNIQUE(account_id), FOREIGN KEY(account_id) REFERENCES eim_accounts(account_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin',
    'CREATE TABLE IF NOT EXISTS eim_web_sessions (token_hash VARCHAR(64) PRIMARY KEY, account_id VARCHAR(255) NOT NULL, expires_at DATETIME(3) NOT NULL, KEY web_sessions_expiry(expires_at), FOREIGN KEY(account_id) REFERENCES eim_accounts(account_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin',
    'CREATE TABLE IF NOT EXISTS eim_web_auth_transactions (token_hash VARCHAR(64) PRIMARY KEY, state TEXT NOT NULL, nonce TEXT NOT NULL, verifier TEXT NOT NULL, return_to TEXT NOT NULL, expires_at DATETIME(3) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin',
    'CREATE TABLE IF NOT EXISTS eim_web_objects (object_key VARCHAR(512) PRIMARY KEY, size_bytes INT NOT NULL, metadata_json LONGTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin',
    'CREATE TABLE IF NOT EXISTS eim_web_object_chunks (object_key VARCHAR(512) NOT NULL, chunk_index INT NOT NULL, body MEDIUMBLOB NOT NULL, PRIMARY KEY(object_key,chunk_index), FOREIGN KEY(object_key) REFERENCES eim_web_objects(object_key) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin',
  );
  return { statements, constraints };
}

export async function migrateMysqlDatabase(client, version) {
  const connection = client.raw;
  const { statements, constraints } = mysqlSchemaStatements();
  const checksum = createHash('sha256').update(JSON.stringify({ statements, constraints })).digest('hex');
  const [[lock]] = await connection.query("SELECT GET_LOCK('arab-experts-schema', 15) AS acquired");
  if (Number(lock.acquired) !== 1) throw new Error('Schema lock unavailable');
  try {
    const [tables] = await connection.query("SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE() AND LEFT(table_name,4)='eim_'");
    if (tables.length && !tables.some(table => table.name === 'eim_mysql_setup')) throw new Error('Existing eim_ tables require review; setup made no changes');
    await connection.query('CREATE TABLE IF NOT EXISTS eim_mysql_setup (id INT PRIMARY KEY, sha256 VARCHAR(64) NOT NULL, complete INT NOT NULL DEFAULT 0) ENGINE=InnoDB');
    const [saved] = await connection.query('SELECT sha256, complete FROM eim_mysql_setup WHERE id=1');
    if (saved.length && saved[0].sha256 !== checksum) throw new Error('MySQL schema changed: an explicit migration is required');
    if (!saved.length) await connection.execute('INSERT INTO eim_mysql_setup(id,sha256) VALUES(1,?)', [checksum]);
    // MySQL DDL commits implicitly. Each step can resume safely after interruption;
    // the ready marker is written only after every table and constraint succeeds.
    for (const sql of statements) await connection.query(sql);
    for (const constraint of constraints) {
      const [existing] = await connection.execute('SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name=? AND constraint_name=?', [constraint.table, constraint.name]);
      if (!existing.length) await connection.query(constraint.sql);
    }
    await connection.query('CREATE TABLE IF NOT EXISTS eim_web_schema_migrations (name VARCHAR(255) PRIMARY KEY, sha256 VARCHAR(64) NOT NULL) ENGINE=InnoDB');
    await connection.execute('INSERT INTO eim_web_schema_migrations(name,sha256) VALUES(?,?) ON DUPLICATE KEY UPDATE sha256=VALUES(sha256)', [version, checksum]);
    await connection.query('UPDATE eim_mysql_setup SET complete=1 WHERE id=1');
    return { tables: schema.length + 5, version, driver: 'mysql' };
  } finally { await connection.query("SELECT RELEASE_LOCK('arab-experts-schema')"); }
}
