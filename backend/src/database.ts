import pg from "pg";
import type { PoolClient, QueryResultRow } from "pg";
import type { BackendConfig } from "./config.js";

const { Pool } = pg;
const requiredMigration = "0890_v113_backend_slo_scheduling_notifications";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(config: BackendConfig) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
    allowExitOnIdle: false,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
    application_name: `eim-backend-${config.environment}`,
  });

  pool.on("error", (error) => {
    console.error(JSON.stringify({ level: "error", event: "postgres_pool_error", message: error.message }));
  });

  async function query<Row extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
    return pool.query<Row>(text, [...values]);
  }

  async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function readiness() {
    const result = await query<{ current_database: string; migration_ready: boolean }>(
      `SELECT current_database() AS current_database,
              EXISTS (
                SELECT 1
                FROM integration.schema_migrations
                WHERE migration_name = $1
              ) AS migration_ready`,
      [requiredMigration],
    );
    const row = result.rows[0];
    if (!row?.migration_ready) throw new Error(`Required migration ${requiredMigration} is not applied`);
    return { database: row.current_database, requiredMigration };
  }

  return { query, transaction, readiness, close: () => pool.end() };
}
