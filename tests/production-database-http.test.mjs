import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebPool } from '../server/database.mjs';
import { migrateWebDatabase } from '../server/migrate-web.mjs';
import { createSession } from '../server/auth.mjs';

test('real PostgreSQL HTTP flow: identity, saved membership, access denial and restart persistence', {
  skip: !process.env.HOSTING_TEST_DATABASE_URL,
  timeout: 60000,
}, async () => {
  const pool=createWebPool({ WEB_DATABASE_URL:process.env.HOSTING_TEST_DATABASE_URL });
  const client=await pool.connect();
  try { await migrateWebDatabase(client); } finally { client.release(); }
  const nonce=randomUUID();
  const token=await createSession(pool,'https://test-issuer.invalid',{ sub:nonce,email:`${nonce}@test.invalid`,email_verified:true,name:'عضو اختبار' });
  const other=await createSession(pool,'https://test-issuer.invalid',{ sub:`other-${nonce}`,email:`other-${nonce}@test.invalid`,email_verified:true });
  const reservation=createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));
  const origin=`http://127.0.0.1:${port}`;
  let child, log='';
  const environment={...process.env,DEPLOYMENT_MODE:'production',PORT:String(port),APP_ORIGIN:'https://platform.test',
    WEB_DATABASE_URL:process.env.HOSTING_TEST_DATABASE_URL,WEB_DATABASE_SSL:'disable',ENABLE_DOMAIN_BACKEND:'false',
    WEB_OIDC_ISSUER:'https://test-issuer.invalid',WEB_OIDC_CLIENT_ID:'test-client',WEB_OIDC_CLIENT_SECRET:'test-only',
    WEB_STORAGE_BUCKET:'test-only',WEB_STORAGE_REGION:'auto',WEB_STORAGE_ACCESS_KEY_ID:'test-only',WEB_STORAGE_SECRET_ACCESS_KEY:'test-only'};
  async function start() {
    child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:environment,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',data=>{log+=data}); child.stderr.on('data',data=>{log+=data});
    for(let i=0;i<100;i++) {
      if(child.exitCode!==null)throw new Error(log);
      try{if((await fetch(`${origin}/health/ready`)).ok)return}catch{}
      await delay(100);
    }
    throw new Error(`Startup failed: ${log}`);
  }
  async function stop() {
    if(!child||child.exitCode!==null)return;
    const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');
    await Promise.race([exited,delay(11000,undefined,{ref:false})]);
    if(child.exitCode===null)child.kill('SIGKILL');
  }
  async function request(path,method='GET',body,session=token,requestOrigin='https://platform.test') {
    const response=await fetch(origin+path,{method,headers:{Origin:requestOrigin,Cookie:`__Host-eim_session=${session}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}
    return {status:response.status,data};
  }
  try {
    await start();
    assert.equal((await fetch(`${origin}/api/account`,{headers:{'oai-authenticated-user-email':`${nonce}@test.invalid`}})).status,401);
    assert.equal((await request('/api/account','PUT',{memberships:['expert']},token,'https://evil.test')).status,403);
    assert.equal((await request('/api/account')).status,200);
    const account=await request('/api/account','PUT',{memberships:['expert']});
    assert.equal(account.status,200,JSON.stringify(account));
    const party=await request('/api/party-profile','PUT',{partyType:'PERSON',displayNameAr:'عضو اختبار'});
    assert.equal(party.status,200,JSON.stringify(party));
    const profile={membershipCode:'expert',data:{firstName:'قيمة محفوظة'},privacy:{},records:{},currentStep:1,lifecycleStatus:'draft'};
    const save=await request('/api/membership-profiles','PUT',{profiles:[profile]});
    assert.equal(save.status,200,JSON.stringify(save));
    await stop();await start();
    const restored=await request('/api/membership-profiles');
    assert.equal(restored.status,200,JSON.stringify(restored));
    assert.equal(restored.data.profiles[0].data.firstName,'قيمة محفوظة');
    const separate=await request('/api/membership-profiles','GET',undefined,other);
    assert.equal(separate.status,200,JSON.stringify(separate));
    assert.equal(separate.data.profiles.length,0);
    assert.equal((await request('/api/party-profile','PATCH',{partyId:restored.data.activePartyId},other)).status,403);
    const logout=await request('/auth/signout','POST');
    // The redirect clears the browser-local draft page; database session is revoked.
    assert.equal(logout.status,200);
    assert.equal((await request('/api/account')).status,401);
  } finally { await stop();await pool.end(); }
});
