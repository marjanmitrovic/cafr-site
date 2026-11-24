import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { uptimeProbeLogger } from '../server/uptime-probe-logger.js';

function request(method, path, headers = {}) {
  return { method, path, get: name => headers[name.toLowerCase()] };
}

test('a marked static HEAD probe logs its completed HTTP result once', t => {
  const logs = [];
  t.mock.method(console, 'info', (...args) => logs.push(args));
  const res = Object.assign(new EventEmitter(), { statusCode: 200 });
  let nextCalls = 0;
  uptimeProbeLogger(request('HEAD', '/', { 'x-ucfr-uptime-probe': '1', 'cf-ray': 'probe-ray' }), res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(logs.length, 0);
  res.emit('finish');
  res.emit('finish');
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[UPTIME HTTP]');
  const data = JSON.parse(logs[0][1]);
  assert.equal(data.method, 'HEAD');
  assert.equal(data.path, '/');
  assert.equal(data.status, 200);
  assert.equal(data.cfRay, 'probe-ray');
  assert.ok(Number.isFinite(Date.parse(data.receivedAt)));
  assert.ok(data.durationMs >= 0);
});

test('ordinary page requests and authentication requests are not logged', t => {
  const logs = [];
  t.mock.method(console, 'info', (...args) => logs.push(args));
  const marked = { 'x-ucfr-uptime-probe': '1' };
  for (const req of [request('GET', '/', marked), request('HEAD', '/'), request('HEAD', '/api/health', marked), request('POST', '/api/auth/login', marked)]) {
    const res = new EventEmitter();
    let nextCalls = 0;
    uptimeProbeLogger(req, res, () => { nextCalls += 1; });
    res.emit('finish');
    assert.equal(nextCalls, 1);
  }
  assert.deepEqual(logs, []);
});

test('probe logging excludes bodies, cookies, authorization and query strings', t => {
  const logs = [];
  t.mock.method(console, 'info', (...args) => logs.push(args));
  const req = {
    ...request('HEAD', '/', { 'x-ucfr-uptime-probe': '1', authorization: 'secret-auth', cookie: 'secret-cookie' }),
    originalUrl: '/?token=secret-query', body: { password: 'secret-password' },
  };
  const res = Object.assign(new EventEmitter(), { statusCode: 503 });
  uptimeProbeLogger(req, res, () => {});
  res.emit('finish');
  assert.equal(logs.length, 1);
  assert.equal(JSON.parse(logs[0][1]).status, 503);
  assert.equal(JSON.parse(logs[0][1]).cfRay, null);
  assert.doesNotMatch(JSON.stringify(logs), /secret-|password|authorization|cookie/);
});
