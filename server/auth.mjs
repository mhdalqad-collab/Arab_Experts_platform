import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as oidc from 'openid-client';
import { getWebPool } from './database.mjs';

export const tokenHash = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/account';
  const url = new URL(value, 'https://app.invalid');
  if (url.origin !== 'https://app.invalid' || /^\/(auth|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname)) return '/account';
  return url.pathname + url.search + url.hash;
}
export function appOrigin(environment = process.env) {
  const url = new URL(environment.APP_ORIGIN || 'http://localhost:3000');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('APP_ORIGIN must be an origin');
  if (url.protocol !== 'https:' && !(environment.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('APP_ORIGIN must use HTTPS outside local development');
  return url.origin;
}
export function sessionCookieName() {
  return process.env.APP_ORIGIN?.startsWith('https://') ? '__Host-eim_session' : 'eim_session';
}
export function readCookie(header, name) {
  return String(header || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
export function loginConnection(method, environment = process.env) {
  if (!method) return undefined;
  const connections = { google: environment.WEB_OIDC_GOOGLE_CONNECTION, email: environment.WEB_OIDC_EMAIL_CONNECTION };
  if (!Object.hasOwn(connections, method) || !connections[method]) throw new Error('Login method unavailable');
  return connections[method];
}
function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.APP_ORIGIN?.startsWith('https://') ? '; Secure' : ''}`;
}
export function sameOriginMutation(request, origin) {
  return !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method || '') || request.headers.origin === origin;
}
export async function findSession(token, pool = getWebPool()) {
  if (!pool || !/^[A-Za-z0-9_-]{43}$/.test(token || '')) return null;
  const result = await pool.query(`SELECT a.email, a.display_name FROM web_sessions s
    JOIN accounts a ON a.account_id=s.account_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND a.status='ACTIVE'`, [tokenHash(token)]);
  const row = result.rows[0];
  return row ? { email: row.email, fullName: row.display_name, displayName: row.display_name || row.email } : null;
}
export async function createSession(pool, issuer, claims) {
  if (!claims.sub || claims.email_verified !== true || typeof claims.email !== 'string' || !claims.email.includes('@')) throw new Error('Verified identity email required');
  const email = claims.email.trim().toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (pool.dialect === 'mysql') {
      const lock = await client.query('SELECT GET_LOCK($1, 10) AS acquired', [tokenHash(`${issuer}:${claims.sub}`)]);
      if (Number(lock.rows[0]?.acquired) !== 1) throw new Error('Identity lock unavailable');
    } else await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${issuer}:${claims.sub}`]);
    const existing = await client.query('SELECT account_id FROM web_identities WHERE issuer=$1 AND subject=$2', [issuer, claims.sub]);
    let accountId = existing.rows[0]?.account_id;
    if (!accountId) {
      // A matching email alone must never silently attach another identity.
      accountId = randomUUID();
      const now = new Date().toISOString();
      await client.query(`INSERT INTO accounts(account_id,email,display_name,status,created_at,updated_at)
        VALUES($1,$2,$3,'ACTIVE',$4,$4)`, [accountId, email, String(claims.name || email).slice(0, 240), now]);
      await client.query('INSERT INTO web_identities(issuer,subject,account_id) VALUES($1,$2,$3)', [issuer, claims.sub, accountId]);
    }
    const account = await client.query('SELECT status FROM accounts WHERE account_id=$1', [accountId]);
    if (account.rows[0]?.status !== 'ACTIVE') throw new Error('Account unavailable');
    const token = randomToken();
    await client.query("INSERT INTO web_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [tokenHash(token), accountId]);
    await client.query('DELETE FROM web_sessions WHERE expires_at<now()');
    await client.query('COMMIT');
    return token;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally {
    try { if (pool.dialect === 'mysql') await client.query('SELECT RELEASE_LOCK($1)', [tokenHash(`${issuer}:${claims.sub}`)]); }
    finally { client.release(); }
  }
}

export async function consumeAuthTransaction(pool, hash, state) {
  if (pool.dialect !== 'mysql') return pool.query(`DELETE FROM web_auth_transactions
    WHERE token_hash=$1 AND state=$2 AND expires_at>now() RETURNING *`, [hash, state]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM web_auth_transactions WHERE token_hash=$1 AND state=$2 AND expires_at>now() FOR UPDATE', [hash, state]);
    if (result.rows.length) await client.query('DELETE FROM web_auth_transactions WHERE token_hash=$1', [hash]);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
let configuration;
async function oidcConfiguration() {
  if (!configuration) configuration = oidc.discovery(new URL(process.env.WEB_OIDC_ISSUER), process.env.WEB_OIDC_CLIENT_ID,
    process.env.WEB_OIDC_CLIENT_SECRET, undefined, { execute: [oidc.enableNonRepudiationChecks] })
    .catch(error => { configuration = undefined; throw error; });
  return configuration;
}
export async function handleAuth(request, response, url) {
  const aliases = { '/signin-with-chatgpt': '/auth/signin', '/signout-with-chatgpt': '/auth/signout', '/callback': '/auth/callback' };
  const route = aliases[url.pathname] || url.pathname;
  if (!['/auth/signin', '/auth/callback', '/auth/signout'].includes(route)) return false;
  response.setHeader('Cache-Control', 'no-store');
  const methods = route === '/auth/signout' ? ['GET', 'POST'] : ['GET'];
  if (!methods.includes(request.method)) { response.writeHead(405, { Allow: methods.join(', ') }).end(); return true; }
  const pool = getWebPool();
  if (process.env.DEPLOYMENT_MODE === 'preview' || !pool || !process.env.WEB_OIDC_ISSUER) {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('تسجيل الدخول غير مفعّل بعد. يرجى إكمال إعداد قاعدة البيانات وموفر الهوية.');
    return true;
  }
  const origin = appOrigin();
  const transactionCookie = process.env.APP_ORIGIN?.startsWith('https://') ? '__Host-eim_login' : 'eim_login';
  try {
    if (route === '/auth/signout') {
      if (request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'" });
        response.end('<html lang="ar" dir="rtl"><meta charset="utf-8"><title>تسجيل الخروج</title><form method="post" action="/auth/signout"><button>تأكيد تسجيل الخروج</button></form></html>');
        return true;
      }
      if (!sameOriginMutation(request, origin)) { response.writeHead(403).end(); return true; }
      const token = readCookie(request.headers.cookie, sessionCookieName());
      await pool.query('DELETE FROM web_sessions WHERE token_hash=$1', [tokenHash(token)]);
      response.setHeader('Set-Cookie', cookie(sessionCookieName(), '', 0));
      response.writeHead(303, { Location: '/eim/signed-out.html' }).end();
      return true;
    }
    if (route === '/auth/signin' && !url.searchParams.has('method') && process.env.WEB_OIDC_GOOGLE_CONNECTION && process.env.WEB_OIDC_EMAIL_CONNECTION) {
      const destination = safeReturnPath(url.searchParams.get('return_to'));
      const link = method => `/auth/signin?${new URLSearchParams({ method, return_to: destination }).toString().replaceAll('&', '&amp;')}`;
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" });
      response.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>تسجيل الدخول | شبكة الخبراء العرب</title><style>body{font-family:system-ui;background:#f3f7fa;color:#12334c;margin:0;padding:8vh 20px}main{max-width:460px;margin:auto;background:white;padding:32px;border-radius:20px;border:1px solid #d9e3eb}h1{font-size:26px}a{display:block;padding:16px;margin:16px 0;border-radius:10px;text-decoration:none;text-align:center;background:#12334c;color:white}p{line-height:1.8}a:last-child{background:transparent;color:#12334c}</style><main><h1>مرحباً بك في شبكة الخبراء العرب</h1><p>سجّل الدخول أو أنشئ حسابك بالطريقة التي تناسبك.</p><a href="${link('google')}">المتابعة باستخدام Google</a><a href="${link('email')}">البريد الإلكتروني وكلمة المرور</a><p>للحسابات الجديدة، أكّد بريدك الإلكتروني قبل تسجيل الدخول.</p><a href="/">العودة إلى الموقع</a></main></html>`);
      return true;
    }
    const connection = route === '/auth/signin' ? loginConnection(url.searchParams.get('method')) : undefined;
    const config = await oidcConfiguration();
    if (route === '/auth/signin') {
      const verifier = oidc.randomPKCECodeVerifier(), state = oidc.randomState(), nonce = oidc.randomNonce(), token = randomToken();
      await pool.query('DELETE FROM web_auth_transactions WHERE expires_at<now()');
      await pool.query(`INSERT INTO web_auth_transactions(token_hash,state,nonce,verifier,return_to,expires_at)
        VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')`,
      [tokenHash(token), state, nonce, verifier, safeReturnPath(url.searchParams.get('return_to'))]);
      const redirect = oidc.buildAuthorizationUrl(config, { redirect_uri: `${origin}/auth/callback`, scope: 'openid email profile',
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce,
        ...(connection ? { connection } : {}) });
      response.setHeader('Set-Cookie', cookie(transactionCookie, token, 600));
      response.writeHead(302, { Location: redirect.href }).end();
      return true;
    }
    const transactionToken = readCookie(request.headers.cookie, transactionCookie);
    response.setHeader('Set-Cookie', cookie(transactionCookie, '', 0));
    const result = await consumeAuthTransaction(pool, tokenHash(transactionToken), url.searchParams.get('state'));
    const flow = result.rows[0];
    if (!flow) throw new Error('Invalid or expired login');
    const tokens = await oidc.authorizationCodeGrant(config, new URL(`/auth/callback${url.search}`, origin), {
      pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new Error('Identity token required');
    const token = await createSession(pool, process.env.WEB_OIDC_ISSUER, claims);
    const oldToken = readCookie(request.headers.cookie, sessionCookieName());
    if (oldToken) await pool.query('DELETE FROM web_sessions WHERE token_hash=$1', [tokenHash(oldToken)]);
    response.setHeader('Set-Cookie', [cookie(transactionCookie, '', 0), cookie(sessionCookieName(), token, 28800)]);
    response.writeHead(303, { Location: safeReturnPath(flow.return_to) }).end();
  } catch {
    console.error('authentication_failed');
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('تعذر إكمال تسجيل الدخول. حاول مرة أخرى أو تواصل مع مسؤول المنصة.');
  }
  return true;
}
