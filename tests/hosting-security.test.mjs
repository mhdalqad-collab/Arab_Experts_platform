import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadServerConfig } from '../server/config.mjs';
import { safeReturnPath, sameOriginMutation, appOrigin, readCookie } from '../server/auth.mjs';
import { createObjectStorage } from '../server/storage.mjs';

test('production fails closed without services; preview is explicit and accepts assigned ports', () => {
  assert.throws(() => loadServerConfig({}), /Missing configuration/);
  assert.equal(loadServerConfig({ DEPLOYMENT_MODE:'preview', PORT:'45871' }).port, 45871);
  for (const port of ['-1', '0', '3000x', '65536']) assert.throws(() => loadServerConfig({ DEPLOYMENT_MODE:'preview', PORT:port }), /PORT/);
  assert.throws(() => appOrigin({ APP_ORIGIN:'http://example.com', NODE_ENV:'production' }), /HTTPS/);
  assert.throws(() => appOrigin({ APP_ORIGIN:'https://example.com/path' }), /origin/);
});
test('redirects cannot escape the application or loop into authentication', () => {
  for (const path of ['//evil.test','/\\evil.test','https://evil.test','/auth/callback','/signin-with-chatgpt','/\nattack']) assert.equal(safeReturnPath(path), '/account');
  assert.equal(safeReturnPath('/eim/index.html#/60'), '/eim/index.html#/60');
});
test('cookie writes require exact Origin and cookies are read by exact name', () => {
  for (const origin of [undefined,'null','https://evil.test']) assert.equal(sameOriginMutation({ method:'POST',headers:{origin} },'https://app.test'),false);
  assert.equal(sameOriginMutation({ method:'PATCH',headers:{origin:'https://app.test'} },'https://app.test'),true);
  assert.equal(readCookie('other_eim_session=bad; eim_session=valid','eim_session'),'valid');
});
test('private object storage preserves bytes/metadata and only maps missing keys to null', async () => {
  const commands=[];
  let failure;
  const client={async send(command) { commands.push(command); if(failure)throw failure; return { Body:{transformToWebStream:()=>new ReadableStream()},ContentLength:3 }; }};
  const store=createObjectStorage({ WEB_STORAGE_BUCKET:'private-documents' },client);
  await store.put('parties/one/doc',new Uint8Array([1,2,3]).buffer,{httpMetadata:{contentType:'application/pdf'},customMetadata:{sha256:'hash'}});
  assert.equal(commands[0].input.Bucket,'private-documents');
  assert.equal(commands[0].input.ACL,undefined);
  assert.deepEqual(commands[0].input.Body,new Uint8Array([1,2,3]));
  assert.equal((await store.get('parties/one/doc')).size,3);
  await store.delete('parties/one/doc');
  failure={ name:'NoSuchKey' };
  assert.equal(await store.get('missing'),null);
  failure=new Error('AccessDenied');
  await assert.rejects(()=>store.get('private'),/AccessDenied/);
});
