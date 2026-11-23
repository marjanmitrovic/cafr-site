import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithWakeup } from '../src/backend-wakeup.js';

const LOGIN = 'https://ucfr.cz/api/auth/login';
const BODY = JSON.stringify({ email: 'diagnostic@example.invalid', password: 'test-only' });
const waking = (retryAfter = '10') => Response.json({ code: 'BACKEND_WAKING_UP' }, {
  status: 503,
  headers: { 'X-UCFR-Response-Source': 'render-wakeup', 'Retry-After': retryAfter },
});

test('login waits for the rejected cold-start request and sends the same body after wakeup', async () => {
  let time = 0;
  const requests = [];
  const delays = [];
  const notices = [];
  const response = await fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    fetchImpl: async (url, init) => {
      requests.push({ url, body: init.body, method: init.method });
      return requests.length < 3 ? waking() : Response.json({ token: 'test-token' });
    },
    now: () => time,
    wait: async (ms) => { delays.push(ms); time += ms; },
    onWaiting: (notice) => notices.push(notice),
  });
  assert.equal(requests.length, 3);
  assert.deepEqual(delays, [10_000, 10_000]);
  assert.equal(notices.length, 2);
  assert.ok(requests.every((request) => request.url === LOGIN && request.body === BODY && request.method === 'POST'));
  assert.deepEqual(await response.json(), { token: 'test-token' });
});

test('incorrect credentials reach the app once and are not retried', async () => {
  let calls = 0;
  const response = await fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    fetchImpl: async () => { calls += 1; return Response.json({ error: 'Invalid email or password' }, { status: 401 }); },
  });
  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});

test('an ordinary 429 keeps its status and is never replayed', async () => {
  let calls = 0;
  const response = await fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    fetchImpl: async () => { calls += 1; return new Response('Too Many Requests', { status: 429 }); },
  });
  assert.equal(response.status, 429);
  assert.equal(calls, 1);
});

test('a generic application 503 does not permit a login replay', async () => {
  let calls = 0;
  const response = await fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    fetchImpl: async () => { calls += 1; return Response.json({ error: 'Database unavailable' }, { status: 503 }); },
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test('network errors never cause a duplicate login submission', async () => {
  let calls = 0;
  await assert.rejects(fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    fetchImpl: async () => { calls += 1; throw new TypeError('Connection lost'); },
  }), /Connection lost/);
  assert.equal(calls, 1);
});

test('other writes and non-replayable login bodies are not resubmitted', async () => {
  for (const [url, init] of [
    ['https://ucfr.cz/api/auth/register', { method: 'POST', body: BODY }],
    [LOGIN, { method: 'POST', body: new Blob([BODY]) }],
  ]) {
    let calls = 0;
    const response = await fetchWithWakeup(url, init, {
      fetchImpl: async () => { calls += 1; return waking(); },
    });
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
  }
});

test('Retry-After beyond the request budget stops without another request', async () => {
  let calls = 0;
  const response = await fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    fetchImpl: async () => { calls += 1; return waking('900'); },
    now: () => 0,
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test('persistent hibernation has a bounded retry count', async () => {
  let calls = 0;
  let time = 0;
  const response = await fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    fetchImpl: async () => { calls += 1; return waking(); },
    maxRetries: 2,
    now: () => time,
    wait: async (ms) => { time += ms; },
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 3);
});

test('cancellation while waiting prevents another login request', async () => {
  const cancel = new AbortController();
  const reason = new Error('User canceled');
  let calls = 0;
  await assert.rejects(fetchWithWakeup(LOGIN, { method: 'POST', body: BODY, signal: cancel.signal }, {
    fetchImpl: async () => { calls += 1; return waking(); },
    wait: async () => { cancel.abort(reason); },
  }), /User canceled/);
  assert.equal(calls, 1);
});

test('a hanging request is aborted at the deadline', async () => {
  await assert.rejects(fetchWithWakeup(LOGIN, { method: 'POST', body: BODY }, {
    timeoutMs: 15,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  }), { name: 'TimeoutError' });
});

test('read-only member requests also recover after wakeup', async () => {
  let calls = 0;
  const response = await fetchWithWakeup('https://ucfr.cz/api/auth/me', {}, {
    fetchImpl: async () => ++calls === 1 ? waking() : Response.json({ user: { id: 'test-member' } }),
    wait: async () => {},
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
});
