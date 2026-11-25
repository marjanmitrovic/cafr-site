import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorker } from './worker.js';

const token = 'a'.repeat(48);
const env = { LAB_TOKEN: token, LAB_DATABASE_URL: 'synthetic-test-only' };
const request = (path, method = 'GET', auth = token) => new Request('https://lab.example.invalid' + path, { method, headers: { Authorization: 'Bearer ' + auth } });
function fixture() {
  const calls = [];
  const worker = makeWorker({ checkDatabase: async value => { calls.push(['db',value]); return true; }, benchmarkBcrypt: async () => { calls.push(['bcrypt']); return true; } });
  return { calls, worker };
}
test('public health is independent of DB, token and Render', async () => {
  const {worker,calls} = fixture();
  const r = await worker.fetch(request('/health'), {});
  assert.equal(r.status,200);
  assert.equal((await r.json()).experimental,true);
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.deepEqual(calls,[]);
});
test('diagnostics fail closed; wrong methods and production endpoints are not served', async () => {
  const {worker,calls} = fixture();
  assert.equal((await worker.fetch(request('/diagnostics/database','POST','wrong'),env)).status,401);
  assert.equal((await worker.fetch(request('/diagnostics/bcrypt','POST'),{})).status,401);
  assert.equal((await worker.fetch(request('/diagnostics/database'),env)).status,404);
  assert.equal((await worker.fetch(request('/api/auth/login','POST'),env)).status,404);
  assert.deepEqual(calls,[]);
});
test('authorized DB test calls one read-only dependency and exposes no credentials', async () => {
  const {worker,calls} = fixture();
  const r = await worker.fetch(request('/diagnostics/database','POST'),env);
  assert.equal(r.status,200);
  assert.equal((await r.text()).includes(env.LAB_DATABASE_URL),false);
  assert.deepEqual(calls,[['db',env.LAB_DATABASE_URL]]);
});
test('bcrypt uses only the isolated test dependency', async () => {
  const {worker,calls} = fixture();
  const r = await worker.fetch(request('/diagnostics/bcrypt','POST'),env);
  assert.equal(r.status,200);
  assert.deepEqual(calls,[['bcrypt']]);
});
test('unconfigured DB and internal errors return sanitized 503', async () => {
  const worker = makeWorker({checkDatabase:async()=>{throw new Error('secret-connection-string');},benchmarkBcrypt:async()=>false});
  assert.equal((await worker.fetch(request('/diagnostics/database','POST'),{LAB_TOKEN:token})).status,503);
  const r = await worker.fetch(request('/diagnostics/database','POST'),env);
  assert.equal(r.status,503);
  assert.doesNotMatch(await r.text(),/secret-connection-string/);
  assert.equal((await worker.fetch(request('/diagnostics/bcrypt','POST'),env)).status,503);
});
