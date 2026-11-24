import test from 'node:test';
import assert from 'node:assert/strict';
import { monitoringWindow, probeRenderUptime } from '../functions/_shared/uptime-monitor.js';
import worker from '../cloudflare-worker.js';

const NOW = new Date('2026-11-23T12:00:00Z');
const enabled = { UCFR_UPTIME_MONITOR_ENABLED: 'true', UCFR_BACKEND_ORIGIN: 'https://cafr-site.onrender.com' };
const options = { env: enabled, scheduledTime: NOW.getTime(), now: () => NOW, log() {} };

test('all calendar months reserve at most 350 monitoring hours, including the daily idle grace', () => {
  for (let year = 2026; year <= 2030; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const plan = monitoringWindow(new Date(Date.UTC(year, month, 15, 12)));
      assert.ok(plan.allowed);
      assert.ok(plan.plannedHours <= 350);
      const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      assert.equal(plan.plannedHours, days * 11.25);
    }
  }
  assert.equal(monitoringWindow(new Date('2026-01-15T12:00:00Z')).plannedHours, 348.75);
  assert.equal(monitoringWindow(NOW).plannedHours, 337.5);
});

test('the Prague 10:00–21:00 window follows both winter and summer time', () => {
  for (const [start, end] of [
    ['2026-11-23T09:00:00Z', '2026-11-23T20:00:00Z'],
    ['2026-07-23T08:00:00Z', '2026-07-23T19:00:00Z'],
  ]) {
    assert.equal(monitoringWindow(new Date(new Date(start).getTime() - 1)).allowed, false);
    assert.equal(monitoringWindow(new Date(start)).allowed, true);
    assert.equal(monitoringWindow(new Date(new Date(end).getTime() - 1)).allowed, true);
    assert.equal(monitoringWindow(new Date(end)).allowed, false);
  }
});

test('disabled, out-of-window and delayed schedules make no network request', async () => {
  const fetchImpl = () => { throw new Error('A skipped probe must not fetch'); };
  assert.equal((await probeRenderUptime({ ...options, env: {}, fetchImpl })).skipped, 'disabled');
  const night = new Date('2026-11-23T22:00:00Z');
  assert.equal((await probeRenderUptime({ ...options, scheduledTime: night.getTime(), now: () => night, fetchImpl })).skipped, 'outside-window');
  assert.equal((await probeRenderUptime({ ...options, scheduledTime: NOW.getTime() - 61_000, fetchImpl })).skipped, 'stale-schedule');
});

test('an enabled probe only requests the static homepage with HEAD and no credentials', async () => {
  let calls = 0;
  const result = await probeRenderUptime({ ...options, fetchImpl: async (url, init) => {
    calls += 1;
    assert.equal(url, 'https://cafr-site.onrender.com/');
    assert.equal(init.method, 'HEAD');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'manual');
    assert.deepEqual(init.headers, { 'X-UCFR-Uptime-Probe': '1' });
    assert.equal(init.body, undefined);
    return new Response(null, { status: 200 });
  } });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
});

test('gateway rate limits and challenges are logged once and never retried', async () => {
  let calls = 0;
  const logs = [];
  const result = await probeRenderUptime({ ...options, log: value => logs.push(value), fetchImpl: async () => {
    calls += 1;
    return new Response(null, { status: 429, headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'test-ray' } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.status, 429);
  assert.equal(result.challenge, true);
  assert.equal(result.cfRay, 'test-ray');
  assert.equal(logs.length, 1);
});

test('a hanging probe times out without sending another request', async () => {
  let calls = 0;
  const result = await probeRenderUptime({ ...options, timeoutMs: 5, fetchImpl: async (_url, init) => {
    calls += 1;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  } });
  assert.equal(result.error, 'timeout');
  assert.equal(calls, 1);
});

test('the deployed worker wires the schedule and exposes its configuration without probing Render', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW.getTime() });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls += 1;
    assert.equal(url, 'https://cafr-site.onrender.com/');
    assert.equal(init.method, 'HEAD');
    return new Response(null, { status: 200 });
  });
  const health = await worker.fetch(new Request('https://ucfr.cz/api/edge-health'), enabled);
  const data = await health.json();
  assert.equal(calls, 0);
  assert.deepEqual(data.uptimeMonitoring, {
    configured: true, timeZone: 'Europe/Prague', startHour: 10, endHour: 21,
    plannedMonitoringHoursThisMonth: 337.5, monthlyMonitoringLimitHours: 350,
  });
  await worker.scheduled({ scheduledTime: NOW.getTime() }, enabled);
  assert.equal(calls, 1);
});
