export type BackendConfig = {
  environment: string;
  host: string;
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  databasePoolMax: number;
  databaseConnectionTimeoutMs: number;
  databaseIdleTimeoutMs: number;
  shutdownTimeoutMs: number;
  identity: null | {
    issuerUrl: string;
    jwksUrl: string;
    audience: string;
    providerCode: string;
  };
  objectStorage: null | { uploadBaseUrl: string; downloadBaseUrl: string; providerCode: string };
  internalTokens: { storageCallback: string | null; malwareScanner: string | null; notificationDispatcher: string | null };
};

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Configuration value must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): BackendConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const appEnvironment = environment.APP_ENV?.trim() || "local";
  const identityValues = [
    environment.IDENTITY_ISSUER_URL?.trim(),
    environment.IDENTITY_JWKS_URL?.trim(),
    environment.IDENTITY_AUDIENCE?.trim(),
    environment.IDENTITY_PROVIDER_CODE?.trim(),
  ];
  const configuredIdentityValues = identityValues.filter(Boolean);
  if (configuredIdentityValues.length > 0 && configuredIdentityValues.length !== identityValues.length) {
    throw new Error("All IDENTITY_* OIDC settings must be configured together");
  }
  if ((appEnvironment === "production" || appEnvironment === "staging") && configuredIdentityValues.length === 0) {
    throw new Error("OIDC identity configuration is required outside local/test environments");
  }
  return {
    environment: appEnvironment,
    host: environment.BACKEND_HOST?.trim() || "127.0.0.1",
    port: integer(environment.BACKEND_PORT, 8788, 1, 65535),
    databaseUrl,
    databaseSsl: environment.DATABASE_SSL?.toLowerCase() === "require",
    databasePoolMax: integer(environment.DATABASE_POOL_MAX, 10, 1, 100),
    databaseConnectionTimeoutMs: integer(environment.DATABASE_CONNECTION_TIMEOUT_MS, 5000, 100, 60000),
    databaseIdleTimeoutMs: integer(environment.DATABASE_IDLE_TIMEOUT_MS, 30000, 1000, 600000),
    shutdownTimeoutMs: integer(environment.BACKEND_SHUTDOWN_TIMEOUT_MS, 10000, 1000, 60000),
    identity: configuredIdentityValues.length === identityValues.length ? {
      issuerUrl: identityValues[0]!,
      jwksUrl: identityValues[1]!,
      audience: identityValues[2]!,
      providerCode: identityValues[3]!,
    } : null,
    objectStorage: environment.OBJECT_STORAGE_UPLOAD_BASE_URL?.trim() ? {
      uploadBaseUrl: environment.OBJECT_STORAGE_UPLOAD_BASE_URL.trim().replace(/\/$/, ""),
      downloadBaseUrl: (environment.OBJECT_STORAGE_DOWNLOAD_BASE_URL?.trim() || environment.OBJECT_STORAGE_UPLOAD_BASE_URL.trim()).replace(/\/$/, ""),
      providerCode: environment.OBJECT_STORAGE_PROVIDER_CODE?.trim() || "PRIVATE_OBJECT_STORAGE",
    } : null,
    internalTokens: {
      storageCallback: environment.OBJECT_STORAGE_CALLBACK_TOKEN?.trim() || null,
      malwareScanner: environment.MALWARE_SCANNER_TOKEN?.trim() || null,
      notificationDispatcher: environment.NOTIFICATION_DISPATCHER_TOKEN?.trim() || null,
    },
  };
}
