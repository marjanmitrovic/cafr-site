import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fetchWithWakeup } from '../src/backend-wakeup.js';

const source = await readFile(new URL('../public/maintenance-notice.js', import.meta.url), 'utf8');
const fetchWrapper = source.slice(0, source.indexOf('\n\n(() => {'));
const USERS_URL = 'https://ucfr.cz/api/admin/users';
const users = [{ id: 'test-member', membershipStatus: 'APPROVED' }];

function install(fetch) {
  const window = {
    fetch,
    location: new URL('https://ucfr.cz/'),
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(fetchWrapper, { window, URL, Request, Response, Headers, AbortController });
  return window.fetch;
}

test('the admin page receives an array through the wakeup helper, which supplies its own signal', async () => {
  const calls = [];
  const wrappedFetch = install(async (input, init) => {
    calls.push({ input, init });
    return Response.json({ users, page: 1, total: 85 });
  });
  const response = await fetchWithWakeup(USERS_URL, {
    headers: { Authorization: 'Bearer test-only' },
  }, { fetchImpl: wrappedFetch });
  const data = await response.json();
  assert.deepEqual(data, users);
  assert.equal(data.filter(user => user.membershipStatus === 'APPROVED').length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, 'https://ucfr.cz/api/admin/users-page?page=1&limit=50');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-only');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('the legacy array response is also preserved without a caller signal', async () => {
  const wrappedFetch = install(async () => Response.json({ users }));
  const response = await wrappedFetch(USERS_URL);
  assert.deepEqual(await response.json(), users);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('a Request object keeps its authorization when mapped to the paginated endpoint', async () => {
  const wrappedFetch = install(async input => {
    assert.equal(input.url, 'https://ucfr.cz/api/admin/users-page?page=1&limit=50');
    assert.equal(input.headers.get('Authorization'), 'Bearer test-only');
    return Response.json({ users });
  });
  const response = await wrappedFetch(new Request(USERS_URL, {
    headers: { Authorization: 'Bearer test-only' },
  }));
  assert.deepEqual(await response.json(), users);
});

test('an aborted member request or failed login is never sent again by the wrapper', async () => {
  for (const [url, init, error] of [
    [USERS_URL, { signal: new AbortController().signal }, new DOMException('Cancelled', 'AbortError')],
    ['https://ucfr.cz/api/auth/login', { method: 'POST', body: '{}' }, new TypeError('Connection lost')],
  ]) {
    let calls = 0;
    const wrappedFetch = install(async () => { calls += 1; throw error; });
    await assert.rejects(wrappedFetch(url, init), actual => actual === error);
    assert.equal(calls, 1);
  }
});

test('an unsuccessful admin response is returned unchanged', async () => {
  const original = Response.json({ error: 'Unauthorized' }, { status: 401 });
  const wrappedFetch = install(async () => original);
  const response = await wrappedFetch(USERS_URL, { signal: new AbortController().signal });
  assert.equal(response, original);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Unauthorized' });
});
