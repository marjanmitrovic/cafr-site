import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyToRender } from '../functions/_shared/render-proxy.js';
import { fetchWithWakeup } from '../src/backend-wakeup.js';

test('the observed Render hibernation 429 becomes an explicit, uncached startup response', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'x-render-routing': 'hibernate-rate-limited', 'rndr-id': 'render-request', 'Retry-After': '15' },
    });
  });
  const response = await proxyToRender({ request: new Request('https://ucfr.cz/api/auth/login'), env: {} });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('X-UCFR-Response-Source'), 'render-wakeup');
  assert.equal(response.headers.get('X-UCFR-Request-ID'), 'render-request');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Retry-After'), '15');
  assert.equal((await response.json()).code, 'BACKEND_WAKING_UP');
  assert.equal(calls, 1);
});

test('a real authentication rate limit remains a 429', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Too many attempts' }, {
    status: 429, headers: { 'X-UCFR-Response-Source': 'api' },
  }));
  const response = await proxyToRender({ request: new Request('https://ucfr.cz/api/auth/login'), env: {} });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('X-UCFR-Response-Source'), 'api');
  assert.deepEqual(await response.json(), { error: 'Too many attempts' });
});

test('an upstream 429 without the hibernation marker is not reclassified', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Limited', { status: 429 }));
  const response = await proxyToRender({ request: new Request('https://ucfr.cz/api/auth/login'), env: {} });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('X-UCFR-Response-Source'), null);
});

test('login JSON, authorization and app errors pass through the proxy unchanged', async (t) => {
  const body = JSON.stringify({ email: 'diagnostic@example.invalid', password: 'test-only' });
  t.mock.method(globalThis, 'fetch', async (upstream) => {
    assert.equal(upstream.url, 'https://cafr-site.onrender.com/api/auth/login');
    assert.equal(upstream.method, 'POST');
    assert.equal(await upstream.text(), body);
    assert.equal(upstream.headers.get('Authorization'), 'Bearer test-only');
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  });
  const response = await proxyToRender({
    request: new Request('https://ucfr.cz/api/auth/login', {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-only' },
    }), env: {},
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid email or password' });
});

test('the proxy and browser recover together while the login app executes only once', async (t) => {
  let routed = 0;
  let applicationCalls = 0;
  const body = JSON.stringify({ email: 'diagnostic@example.invalid', password: 'test-only' });
  t.mock.method(globalThis, 'fetch', async (request) => {
    routed += 1;
    if (routed === 1) return new Response('Too Many Requests', {
      status: 429, headers: { 'x-render-routing': 'hibernate-rate-limited' },
    });
    applicationCalls += 1;
    assert.equal(await request.text(), body);
    return Response.json({ token: 'test-only-token' });
  });
  const waits = [];
  const response = await fetchWithWakeup('https://ucfr.cz/api/auth/login', { method: 'POST', body }, {
    fetchImpl: (url, init) => proxyToRender({ request: new Request(url, init), env: {} }),
    wait: async (ms) => { waits.push(ms); },
  });
  assert.deepEqual(await response.json(), { token: 'test-only-token' });
  assert.equal(routed, 2);
  assert.equal(applicationCalls, 1);
  assert.deepEqual(waits, [10_000]);
});
