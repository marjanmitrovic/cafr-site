import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/public-news-store.js', import.meta.url), 'utf8');
const NEWS = [{ id: 'published-article', titleCs: 'Aktualita' }];

function harness(fetchImpl) {
  let now = Date.parse('2026-11-18T12:00:00Z');
  const calls = [];
  const window = { location: { hostname: 'ucfr.cz', origin: 'https://ucfr.cz' } };
  const document = { visibilityState: 'visible' };
  const context = vm.createContext({
    window,
    document,
    localStorage: { getItem: () => null },
    Date: class extends Date { static now() { return now; } },
    console: { warn() {} },
    fetch: (...args) => { calls.push(args); return fetchImpl(...args); },
  });
  vm.runInContext(source, context);
  return {
    store: window.UCFRPublicNews,
    calls,
    document,
    advance: (ms) => { now += ms; },
  };
}

test('the list and carousel share one pending HTTP request', async () => {
  let finish;
  const h = harness(() => new Promise((resolve) => { finish = resolve; }));
  const list = h.store.load();
  const carousel = h.store.load();
  assert.equal(list, carousel);
  assert.equal(h.calls.length, 1);
  finish(Response.json(NEWS));
  assert.deepEqual(await list, NEWS);
  assert.equal(h.calls[0][0], 'https://ucfr.cz/api/news');
});

test('DOM rescans reuse news for five minutes without another request', async () => {
  const h = harness(async () => Response.json(NEWS));
  await h.store.load();
  for (let i = 0; i < 30; i += 1) await h.store.load();
  assert.equal(h.calls.length, 1);
  h.advance(300_001);
  await h.store.load();
  assert.equal(h.calls.length, 2);
});

test('429 keeps the last articles and honors Retry-After even on forced refresh', async () => {
  let requests = 0;
  const h = harness(async () => ++requests === 1
    ? Response.json(NEWS)
    : new Response('limited', { status: 429, headers: { 'Retry-After': '1200' } }));
  await h.store.load();
  assert.deepEqual(await h.store.load(true), NEWS);
  h.advance(600_000);
  assert.deepEqual(await h.store.load(true), NEWS);
  assert.equal(h.calls.length, 2);
  h.advance(600_001);
  await h.store.load(true);
  assert.equal(h.calls.length, 3);
});

test('hidden tabs keep cached news without waking the backend after the cache expires', async () => {
  const h = harness(async () => Response.json(NEWS));
  await h.store.load();
  h.document.visibilityState = 'hidden';
  h.advance(600_000);
  assert.deepEqual(await h.store.load(), NEWS);
  assert.equal(h.calls.length, 1);
  h.document.visibilityState = 'visible';
  await h.store.load();
  assert.equal(h.calls.length, 2);
});

test('Retry-After as an HTTP date postpones retries', async () => {
  const h = harness(async () => new Response('', {
    status: 429, headers: { 'Retry-After': 'Wed, 18 Nov 2026 12:20:00 GMT' },
  }));
  await h.store.load();
  h.advance(600_000);
  await h.store.load(true);
  assert.equal(h.calls.length, 1);
});

test('a connection error backs off and leaves existing articles visible', async () => {
  let requests = 0;
  const h = harness(async () => {
    if (++requests === 1) return Response.json(NEWS);
    throw new TypeError('Connection unavailable');
  });
  await h.store.load();
  assert.deepEqual(await h.store.load(true), NEWS);
  await h.store.load(true);
  assert.equal(h.calls.length, 2);
});

test('an HTML response cannot replace the cached article list', async () => {
  let requests = 0;
  const h = harness(async () => ++requests === 1
    ? Response.json(NEWS)
    : new Response('<html>Starting up</html>'));
  await h.store.load();
  assert.deepEqual(await h.store.load(true), NEWS);
});
