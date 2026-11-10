import mysql from 'mysql2/promise';
import schema from './mysql-schema.json' with { type: 'json' };

const tables = new Set([...schema.map(table => table.name), 'web_identities', 'web_sessions', 'web_auth_transactions', 'web_schema_migrations', 'web_objects', 'web_object_chunks']);
// Only SQL tokens are rewritten. Literals, comments and bound user values are preserved.
export function mysqlQuery(sql, values = []) {
  const args = [];
  const text = sql.replace(/gen_random_uuid\(\)::text|interval '\d+ (?:hours?|minutes?|seconds?)'|'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/|\$(\d+)|"([^"]+)"|`([^`]+)`|\b[A-Za-z_][A-Za-z_0-9]*\b/gi, (token, position, quoted, backtick) => {
      if (/^gen_random_uuid\(\)::text$/i.test(token)) return 'UUID()';
      if (/^interval '/i.test(token)) return token.replace(/interval '(\d+) (hours?|minutes?|seconds?)'/i, (_, n, unit) => `INTERVAL ${n} ${unit.replace(/s$/i, '')}`);
      if (position) {
        if (Number(position) > values.length) throw new Error('SQL binding missing');
        args.push(values[Number(position) - 1]); return '?';
      }
      const name = quoted || backtick || token;
      if (tables.has(name)) return `\`eim_${name}\``;
      if (quoted || backtick || name === 'rank') return `\`${name}\``;
      return token;
    });
  return { text, values: args };
}

// These web API upserts use a single VALUES tuple. Preserve PostgreSQL's explicit
// conflict target: MySQL's ON DUPLICATE KEY can otherwise update the wrong account.
export async function runMysqlQuery(connection, sql, values = []) {
  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) {
    await connection.query(sql); return { rows: [], rowCount: 0, fields: [] };
  }
  const upsert = sql.match(/^\s*(INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*?)\))\s*ON CONFLICT\s*\(([^)]+)\)\s*DO UPDATE SET\s*([\s\S]+)$/i);
  if (upsert) {
    const [, insert, table, columns, expressions, targets, assignments] = upsert;
    const names = columns.split(',').map(x => x.trim());
    const expressionsList = expressions.split(/,(?![^()]*\))/).map(x => x.trim());
    if (names.length !== expressionsList.length) throw new Error('Unsupported MySQL upsert');
    const incoming = Object.fromEntries(names.map((name, i) => [name, expressionsList[i]]));
    const replaceExcluded = text => text.replace(/excluded\.(\w+)/g, (_, name) => {
      if (!incoming[name]) throw new Error('Unknown upsert column');
      return incoming[name];
    });
    try { return await runMysqlQuery(connection, insert, values); }
    catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const condition = targets.split(',').map(name => `${name.trim()} = ${incoming[name.trim()]}`).join(' AND ');
      const found = await runMysqlQuery(connection, `SELECT 1 FROM ${table} WHERE ${condition} FOR UPDATE`, values);
      if (!found.rows.length) throw error;
      const [updates, guard] = assignments.split(/\s+WHERE\s+/i);
      return runMysqlQuery(connection, `UPDATE ${table} SET ${replaceExcluded(updates)} WHERE ${condition}${guard ? ` AND (${replaceExcluded(guard)})` : ''}`, values);
    }
  }
  const ignore = /\s+ON CONFLICT DO NOTHING\s*$/i.test(sql);
  const query = mysqlQuery(sql.replace(/\s+ON CONFLICT DO NOTHING\s*$/i, ''), values);
  try {
    const [result] = await connection.execute(query.text, query.values);
    return { rows: Array.isArray(result) ? result : [], rowCount: Array.isArray(result) ? result.length : result.affectedRows, fields: [] };
  } catch (error) {
    if (ignore && error.code === 'ER_DUP_ENTRY') return { rows: [], rowCount: 0, fields: [] };
    throw error;
  }
}

export function createMysqlPool(environment) {
  for (const name of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!environment[name]) throw new Error(`Missing MySQL configuration: ${name}`);
  }
  const port = Number(environment.DB_PORT), max = Number(environment.WEB_DATABASE_POOL_MAX || 5);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DB_PORT');
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error('Invalid WEB_DATABASE_POOL_MAX');
  const raw = mysql.createPool({ host: environment.DB_HOST, port, database: environment.DB_NAME,
    user: environment.DB_USER, password: environment.DB_PASSWORD, connectionLimit: max,
    waitForConnections: true, queueLimit: 50, connectTimeout: 5000, timezone: 'Z',
    charset: 'utf8mb4', decimalNumbers: true, supportBigNumbers: true,
    multipleStatements: false,
    ...(environment.WEB_DATABASE_SSL === 'require' ? { ssl: { rejectUnauthorized: true } } : {}),
  });
  async function connect() {
    const connection = await raw.getConnection();
    try {
      await connection.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION,PIPES_AS_CONCAT', time_zone='+00:00'");
      return { dialect: 'mysql', raw: connection, query: (sql, values) => runMysqlQuery(connection, sql, values), release: () => connection.release() };
    } catch (error) { connection.release(); throw error; }
  }
  return { dialect: 'mysql', connect,
    async query(sql, values) {
      const client = await connect();
      const transaction = /ON CONFLICT\s*\(/i.test(sql);
      try {
        if (transaction) await client.query('BEGIN');
        const result = await client.query(sql, values);
        if (transaction) await client.query('COMMIT');
        return result;
      } catch (error) { if (transaction) await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    end: () => raw.end(),
  };
}
