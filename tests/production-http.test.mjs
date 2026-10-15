import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

let child, origin, log = '';
before(async () => {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, PORT:String(port), DEPLOYMENT_MODE:'preview', ENABLE_DOMAIN_BACKEND:'false', WEB_DATABASE_URL:'' },
    stdio:['ignore','pipe','pipe'],
  });
  child.stdout.on('data', value => { log += value; });
  child.stderr.on('data', value => { log += value; });
  for (let attempt=0; attempt<100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${log}`);
    try { if ((await fetch(`${origin}/health/live`)).ok) return; } catch {}
    await delay(200);
  }
  throw new Error(`Server did not become live: ${log}`);
});
after(async () => {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, delay(12000, undefined, { ref: false })]);
  if (child.exitCode === null) child.kill('SIGKILL');
});
test('the production build redirects to EIM and serves the generated assets', async () => {
  const root = await fetch(origin, { redirect:'manual' });
  assert.ok([301,302,303,307,308].includes(root.status));
  assert.equal(new URL(root.headers.get('location'),origin).pathname,'/eim/index.html');
  const page = await fetch(`${origin}/eim/index.html`);
  assert.equal(page.status,200);
  const html = await page.text();
  assert.ok(html.includes('شبكة الخبراء العرب'));
  const assets = [...html.matchAll(/(?:src|href)="(\.\/(?:js|css)\/[^"?#]+)"/g)].map(match=>match[1]);
  assert.ok(assets.length>=2);
  for (const asset of assets) assert.equal((await fetch(new URL(asset,`${origin}/eim/index.html`))).status,200,asset);
});
test('preview cannot claim readiness, persist data or trust spoofed identity headers', async () => {
  assert.equal((await fetch(`${origin}/health/ready`)).status,503);
  for (const path of ['/api/account','/api/professional-directory','/v1/meta','/auth/signin']) {
    const response=await fetch(`${origin}${path}`,{headers:{'oai-authenticated-user-email':'admin@example.test'}});
    assert.equal(response.status,503,path);
  }
  assert.equal((await fetch(`${origin}/api/account`,{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
});
test('internal callbacks are inaccessible and unsupported auth methods are rejected', async () => {
  assert.equal((await fetch(`${origin}/internal/notifications`)).status,404);
  assert.equal((await fetch(`${origin}/%69nternal/notifications`)).status,404);
  assert.equal((await fetch(`${origin}/auth/signin`,{method:'POST'})).status,405);
});
