import { createServer } from 'node:http';
import next from 'next';
import { loadServerConfig } from './server/config.mjs';
import { handleAuth, sameOriginMutation } from './server/auth.mjs';
import { getWebPool } from './server/database.mjs';
import { WEB_SCHEMA_VERSION } from './server/migrate-web.mjs';

const dev = process.argv.includes('--dev');
process.env.NODE_ENV = dev ? 'development' : 'production';
const config = loadServerConfig();
const application = next({ dev, hostname: '0.0.0.0', port: config.port });
await application.prepare();
const handle = application.getRequestHandler();
let backend;
if (process.env.ENABLE_DOMAIN_BACKEND === 'true') {
  const { createBackendApplication } = await import('./backend/dist/src/application.js');
  backend = createBackendApplication();
}
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  try {
    // Never let callers impersonate the trusted identity service of the old host.
    for (const key of Object.keys(request.headers)) if (key.startsWith('oai-authenticated-')) delete request.headers[key];
    const url = new URL(request.url || '/', 'http://internal');
    const pathname = decodeURIComponent(url.pathname).replace(/\\/g, '/');
    if (pathname === '/internal' || pathname.startsWith('/internal/')) { response.writeHead(404).end(); return; }
    if (pathname === '/health/live') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ status: 'up', mode: config.mode })); return;
    }
    if (pathname === '/health/ready') {
      let ready = config.mode === 'production';
      try {
        const pool = getWebPool();
        const result = pool && await pool.query('SELECT 1 FROM web_schema_migrations WHERE name=$1', [WEB_SCHEMA_VERSION]);
        ready = ready && !!result?.rows.length;
        if (ready && backend) await backend.readiness();
      } catch { ready = false; }
      response.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ status: ready ? 'ready' : 'not_ready', mode: config.mode })); return;
    }
    if (await handleAuth(request, response, url)) return;
    if (pathname.startsWith('/api/')) {
      if (config.mode === 'preview') {
        response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: 'PREVIEW_ONLY', message: 'Configure database, identity and private storage before enabling accounts.' })); return;
      }
      if (!sameOriginMutation(request, config.origin)) { response.writeHead(403).end('INVALID_ORIGIN'); return; }
    }
    if (pathname.startsWith('/v1/')) {
      if (!backend || config.mode === 'preview') { response.writeHead(503).end('DOMAIN_BACKEND_UNAVAILABLE'); return; }
      await backend.handler(request, response); return;
    }
    await handle(request, response);
  } catch {
    console.error('request_failed');
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end('Request failed');
  }
});
server.requestTimeout = 60000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
server.listen(config.port, '0.0.0.0', () => console.log(`Arab Experts listening on port ${config.port} (${config.mode})`));
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  server.close(async () => {
    await application.close();
    await getWebPool()?.end();
    await backend?.close();
    clearTimeout(timer);
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
