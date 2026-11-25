import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { hasPreviewAccess, isPreviewOrigin, missingPreviewSettings, removePreviewCredentials, servePreviewPage } from '../cloudflare/preview.js';

const url = new URL('https://staging.example.workers.dev/preview');
const env = { DATABASE_URL: 'postgresql://synthetic.example.invalid/test', TOKEN_SECRET: 'm'.repeat(48), BREVO_API_KEY: 'synthetic-mail', UCFR_PREVIEW_TOKEN: 'p'.repeat(48) };
const req = headers => new Request(url, { method: 'POST', headers });

test('setup lists only setting names and rejects reused secrets', async () => {
  assert.deepEqual(missingPreviewSettings({}), ['DATABASE_URL', 'TOKEN_SECRET', 'BREVO_API_KEY', 'UCFR_PREVIEW_TOKEN']);
  assert.deepEqual(missingPreviewSettings(env), []);
  assert.ok(missingPreviewSettings({ ...env, LAB_TOKEN: env.UCFR_PREVIEW_TOKEN }).includes('UCFR_PREVIEW_TOKEN'));
  assert.ok(missingPreviewSettings({ ...env, CANDIDATE_ACCESS_TOKEN: env.TOKEN_SECRET }).includes('TOKEN_SECRET'));
  const text = await servePreviewPage(new Request(url), env, url).text();
  for (const value of Object.values(env)) assert.ok(!text.includes(value));
  assert.match(text, /Otvori probni sajt/);
  assert.equal(isPreviewOrigin(new URL('https://ucfr.cz')), false);
  assert.equal(isPreviewOrigin(new URL('http://staging.example.workers.dev')), false);
});

test('browser access requires an independent key and a same-origin submission', () => {
  const header = { 'X-UCFR-Preview-Token': env.UCFR_PREVIEW_TOKEN };
  assert.equal(servePreviewPage(req(header), env, url).status, 403);
  assert.equal(servePreviewPage(req({ ...header, Origin: 'https://other.example' }), env, url).status, 403);
  assert.equal(servePreviewPage(req({ Origin: url.origin, 'X-UCFR-Preview-Token': env.TOKEN_SECRET }), env, url).status, 401);
  const result = servePreviewPage(req({ ...header, Origin: url.origin }), env, url);
  assert.equal(result.status, 204);
  const cookie = result.headers.get('Set-Cookie');
  for (const flag of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=900']) assert.ok(cookie.includes(flag));
  assert.ok(!cookie.includes(env.UCFR_PREVIEW_TOKEN));
  const grant = req({ Cookie: cookie.split(';')[0] });
  assert.ok(hasPreviewAccess(grant, env, url.origin));
  assert.equal(hasPreviewAccess(grant, env, 'https://another.example.workers.dev'), false);
  assert.equal(hasPreviewAccess(grant, { ...env, UCFR_PREVIEW_TOKEN: 'r'.repeat(48) }, url.origin), false);
  const expired = jwt.sign({}, env.UCFR_PREVIEW_TOKEN, { issuer: 'ucfr-worker-preview', audience: url.origin, subject: 'preview', expiresIn: -1 });
  assert.equal(hasPreviewAccess(req({ Cookie: '__Host-ucfr-preview=' + expired }), env, url.origin), false);
  const forwarded = new Headers({ ...header, Cookie: 'theme=dark; ' + cookie.split(';')[0], Authorization: 'Bearer member-session' });
  removePreviewCredentials(forwarded);
  assert.equal(forwarded.get('Cookie'), 'theme=dark');
  assert.equal(forwarded.get('Authorization'), 'Bearer member-session');
  assert.equal(forwarded.has('X-UCFR-Preview-Token'), false);
});
