import assert from 'node:assert/strict';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:8788');
const local = origin.hostname === '127.0.0.1' && origin.protocol === 'http:';
assert.ok(local || (origin.protocol === 'https:' && origin.hostname.endsWith('.workers.dev')), 'Expected the staging Worker hostname');
const get = (path, headers) => fetch(new URL(path, origin), { headers, redirect: 'error' });
const health = await get('/health');
assert.equal(health.status, 200);
const diagnostic = await health.json();
assert.equal(diagnostic.service, 'ucfr-api-lab');
assert.equal(diagnostic.experimental, true);
assert.ok(Object.hasOwn(diagnostic, 'version'));
if (!local) {
  assert.match(diagnostic.version, /^[a-f0-9-]{36}$/i);
  if (process.argv[3]) assert.equal(diagnostic.version, process.argv[3]);
}
const homepage = await get('/');
assert.equal(homepage.status, 200);
assert.match(homepage.headers.get('content-type'), /text\/html/i);
assert.match(await homepage.text(), /UČFR/);
assert.match(await (await get('/diagnostics')).text(), /UCFR – dijagnostika/);
assert.equal((await get('/lab/api/auth/me')).status, 401);
const anonymous = await get('/api/auth/me', { 'X-UCFR-Lab-Token': 'synthetic-test-only' });
assert.equal(anonymous.status, 401);
assert.equal((await anonymous.json()).error, 'Unauthorized');
assert.equal((await get('/uploads/objects/staging-smoke-test')).status, 401);
console.log('Staging site, diagnostics and the protected Express entry points passed.', diagnostic.version || 'Local Worker');
