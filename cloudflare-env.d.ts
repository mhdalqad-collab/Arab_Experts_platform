declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    PLATFORM_ADMIN_EMAILS?: string;
    POSTGRES_OPERATIONS_API_URL?: string;
    POSTGRES_OPERATIONS_API_TOKEN?: string;
    POSTGRES_OPERATIONS_ACTIONS_ENABLED?: string;
    POSTGRES_OPERATIONS_STEP_UP_READY?: string;
  }
}
