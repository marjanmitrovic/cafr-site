import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const service = 'ucfr-api-lab';
const reply = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
function authorized(request, env) {
  const secret = env.LAB_TOKEN;
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 256) return false;
  const supplied = request.headers.get('Authorization') || '';
  const expected = 'Bearer ' + secret;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function makeWorker({ checkDatabase, benchmarkBcrypt }) {
  return {
    async fetch(request, env = {}) {
      const { pathname } = new URL(request.url);
      if (request.method === 'GET' && pathname === '/health') {
        return reply({ ok: true, service, experimental: true });
      }
      const isDb = request.method === 'POST' && pathname === '/diagnostics/database';
      const isBcrypt = request.method === 'POST' && pathname === '/diagnostics/bcrypt';
      if (!isDb && !isBcrypt) return reply({ error: 'Not found' }, 404);
      if (!authorized(request, env)) return reply({ error: 'Unauthorized' }, 401);
      if (isDb && !env.LAB_DATABASE_URL) return reply({ ok: false, error: 'Not configured' }, 503);
      try {
        const ok = isDb ? await checkDatabase(env.LAB_DATABASE_URL) : await benchmarkBcrypt();
        return reply({ ok: ok === true, service, check: isDb ? 'read-only-schema' : 'synthetic-bcrypt-cost-12' }, ok === true ? 200 : 503);
      } catch {
        // Never echo connection strings, passwords, database rows or raw errors.
        return reply({ ok: false, service, error: 'Diagnostic failed' }, 503);
      }
    },
  };
}
