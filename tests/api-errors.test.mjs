import test from 'node:test';
import assert from 'node:assert/strict';
import { apiError } from '../src/api-errors.js';

test('a gateway 429 with no JSON body has a readable Czech message', () => {
  const response = new Response('Too many requests', { status: 429 });
  const error = apiError(response, {});
  assert.match(error.message, /Server dočasně omezuje provoz/);
  assert.equal(error.status, 429);
  assert.equal(error.source, 'upstream');
});

test('application errors and their diagnostic headers are preserved', () => {
  const response = new Response('', {
    status: 429,
    headers: {
      'X-UCFR-Response-Source': 'api',
      'X-UCFR-Request-ID': 'diagnostic-request',
      'Retry-After': '900',
    },
  });
  const error = apiError(response, { error: 'Too many password reset requests' });
  assert.equal(error.message, 'Too many password reset requests');
  assert.equal(error.source, 'api');
  assert.equal(error.requestId, 'diagnostic-request');
  assert.equal(error.retryAfter, '900');
});

test('English clients get an English message for a non-JSON server failure', () => {
  const error = apiError(new Response('', { status: 503 }), null, 'en');
  assert.match(error.message, /server is temporarily unavailable/i);
});

test('a rejected password remains a 401 application error', () => {
  const error = apiError(new Response('', { status: 401 }), { error: 'Invalid email or password' });
  assert.equal(error.message, 'Invalid email or password');
  assert.equal(error.status, 401);
});
