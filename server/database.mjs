import pg from 'pg';

// Preserve the existing web API's SQL contracts while moving storage to PostgreSQL.
// Tokenize literals/comments before translating placeholders; user values stay bound.
export function translateSql(sql) {
  let index = 0;
  let text = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|`([^`]+)`|\?(\d*)/g,
    (token, identifier, position) => {
      if (identifier !== undefined) return `"${identifier}"`;
      if (position !== undefined) {
        index = position ? Math.max(index, Number(position)) : index + 1;
        return `$${position || index}`;
      }
      return token;
    });
  if (/^\s*INSERT OR IGNORE\b/i.test(text)) {
    text = text.replace(/INSERT OR IGNORE/i, 'INSERT').replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  }
  return text;
}

export function createSqlDatabase(pool) {
  class Statement {
    constructor(sql, values = []) { this.sql = sql; this.values = values; }
    bind(...values) { return new Statement(this.sql, values); }
    async execute(client) {
      const query = bindSql(this.sql, this.values);
      const result = await client.query(query.text, query.values);
      // pg returns COUNT and NUMERIC as strings; the previous API used numbers.
      for (const row of result.rows) for (const field of result.fields || []) {
        if ([20, 1700].includes(field.dataTypeID) && row[field.name] !== null) {
          const value = Number(row[field.name]);
          if (Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) row[field.name] = value;
        }
      }
      return { results: result.rows, success: true, meta: { changes: result.rowCount ?? result.affectedRows ?? 0 } };
    }
    async all() { return this.execute(pool); }
    async first() { return (await this.all()).results[0] ?? null; }
    async run() { return this.execute(pool); }
  }
  return {
    prepare: (sql) => new Statement(sql),
    async batch(statements) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const results = [];
        for (const statement of statements) {
          if (!(statement instanceof Statement)) throw new Error('Foreign database statement');
          results.push(await statement.execute(client));
        }
        await client.query('COMMIT');
        return results;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  };
}

export function bindSql(sql, values) {
  const bound = [], positions = new Map();
  const text = translateSql(sql).replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\$(\d+)/g, (token, position) => {
    if (!position) return token;
    const original = Number(position) - 1;
    if (original < 0 || original >= values.length) throw new Error('SQL binding missing');
    if (!positions.has(original)) { bound.push(values[original]); positions.set(original, bound.length); }
    return `$${positions.get(original)}`;
  });
  return { text, values: bound };
}

export function createWebPool(environment = process.env) {
  const connectionString = environment.WEB_DATABASE_URL;
  if (!connectionString) return null;
  const max = Number(environment.WEB_DATABASE_POOL_MAX || 5);
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error('Invalid WEB_DATABASE_POOL_MAX');
  const pool = new pg.Pool({
    connectionString, max, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    // The web compatibility schema is separate from the existing enterprise schemas.
    options: '-c search_path=eim_web -c statement_timeout=15000',
    ...(environment.WEB_DATABASE_SSL === 'require' ? { ssl: { rejectUnauthorized: true } } : {}),
    application_name: 'arab-experts-web',
  });
  pool.on('error', () => console.error('web_database_connection_error'));
  return pool;
}

const poolKey = Symbol.for('arab-experts.web-pool');
export function getWebPool() {
  if (!globalThis[poolKey]) globalThis[poolKey] = createWebPool();
  return globalThis[poolKey];
}
