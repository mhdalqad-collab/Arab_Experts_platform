import { createSqlDatabase, getWebPool } from '../../server/database.mjs';
import { createObjectStorage } from '../../server/storage.mjs';

export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean; meta: { changes: number } }>;
  run(): Promise<{ results: Record<string, unknown>[]; success: boolean; meta: { changes: number } }>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown[]>;
}
let storage: ReturnType<typeof createObjectStorage> | undefined;
export function getRuntime() {
  const pool = getWebPool();
  storage ??= createObjectStorage();
  return { env: {
    DB: pool ? createSqlDatabase(pool) as SqlDatabase : null,
    BUCKET: storage,
    PLATFORM_ADMIN_EMAILS: process.env.PLATFORM_ADMIN_EMAILS,
    POSTGRES_OPERATIONS_API_URL: process.env.POSTGRES_OPERATIONS_API_URL,
    POSTGRES_OPERATIONS_API_TOKEN: process.env.POSTGRES_OPERATIONS_API_TOKEN,
    POSTGRES_OPERATIONS_ACTIONS_ENABLED: process.env.POSTGRES_OPERATIONS_ACTIONS_ENABLED,
    POSTGRES_OPERATIONS_STEP_UP_READY: process.env.POSTGRES_OPERATIONS_STEP_UP_READY,
  } };
}
