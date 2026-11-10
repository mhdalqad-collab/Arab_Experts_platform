import { appOrigin } from './auth.mjs';
export function loadServerConfig(environment = process.env) {
  const port = Number(environment.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const mode = environment.DEPLOYMENT_MODE || 'production';
  if (!['preview', 'production'].includes(mode)) throw new Error('DEPLOYMENT_MODE must be preview or production');
  if (environment.WEB_DATABASE_DRIVER && !['mysql','postgres'].includes(environment.WEB_DATABASE_DRIVER)) throw new Error('Unknown WEB_DATABASE_DRIVER');
  if (environment.WEB_STORAGE_DRIVER && !['mysql','s3'].includes(environment.WEB_STORAGE_DRIVER)) throw new Error('Unknown WEB_STORAGE_DRIVER');
  if (environment.WEB_STORAGE_DRIVER === 'mysql' && environment.WEB_DATABASE_DRIVER !== 'mysql') throw new Error('MySQL storage requires MySQL database');
  if (mode === 'production') {
    const database = environment.WEB_DATABASE_DRIVER === 'mysql' ? ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] : ['WEB_DATABASE_URL'];
    const storage = environment.WEB_STORAGE_DRIVER === 'mysql' ? [] : ['WEB_STORAGE_BUCKET', 'WEB_STORAGE_REGION', 'WEB_STORAGE_ACCESS_KEY_ID', 'WEB_STORAGE_SECRET_ACCESS_KEY'];
    const required = ['APP_ORIGIN', ...database, 'WEB_OIDC_ISSUER', 'WEB_OIDC_CLIENT_ID', 'WEB_OIDC_CLIENT_SECRET', ...storage];
    const missing = required.filter(name => !environment[name]?.trim());
    if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
    if (new URL(environment.WEB_OIDC_ISSUER).protocol !== 'https:') throw new Error('OIDC issuer must use HTTPS');
    if (environment.WEB_STORAGE_ENDPOINT && new URL(environment.WEB_STORAGE_ENDPOINT).protocol !== 'https:') throw new Error('Object storage must use HTTPS');
  }
  return { port, mode, origin: mode === 'production' ? appOrigin(environment) : null };
}
