import { appOrigin } from './auth.mjs';
export function loadServerConfig(environment = process.env) {
  const port = Number(environment.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const mode = environment.DEPLOYMENT_MODE || 'production';
  if (!['preview', 'production'].includes(mode)) throw new Error('DEPLOYMENT_MODE must be preview or production');
  if (mode === 'production') {
    const required = ['APP_ORIGIN', 'WEB_DATABASE_URL', 'WEB_OIDC_ISSUER', 'WEB_OIDC_CLIENT_ID', 'WEB_OIDC_CLIENT_SECRET',
      'WEB_STORAGE_BUCKET', 'WEB_STORAGE_REGION', 'WEB_STORAGE_ACCESS_KEY_ID', 'WEB_STORAGE_SECRET_ACCESS_KEY'];
    const missing = required.filter(name => !environment[name]?.trim());
    if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
    if (new URL(environment.WEB_OIDC_ISSUER).protocol !== 'https:') throw new Error('OIDC issuer must use HTTPS');
    if (environment.WEB_STORAGE_ENDPOINT && new URL(environment.WEB_STORAGE_ENDPOINT).protocol !== 'https:') throw new Error('Object storage must use HTTPS');
  }
  return { port, mode, origin: mode === 'production' ? appOrigin(environment) : null };
}
