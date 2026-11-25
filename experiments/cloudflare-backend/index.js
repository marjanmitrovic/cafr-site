import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { makeWorker } from './worker.js';
import { createAuthPilot, TEST_EMAIL } from './auth-pilot.js';
import { isPreviewOrigin } from '../../cloudflare/preview.js';
import { serveSite } from '../../cloudflare/worker.js';

const fixturePasswordHash = '$2y$12$BRrlWOLxqxVr2eCyftc8wOlmC1xrkxwJ7uROkK/JCD6ldWLqBKe62';
const connect = connectionString => neon(connectionString, {fetchOptions:{signal:AbortSignal.timeout(15000)}});
const authPilot = createAuthPilot({
  findFixture: async connectionString => {
    const sql=connect(connectionString);
    // No production member rows are read. The fixture is a SQL result, not a stored user.
    const rows=await sql`SELECT 'ucfr-lab-fixture'::text AS id, ${TEST_EMAIL}::text AS email,
      ${fixturePasswordHash}::text AS "passwordHash", 'Test'::text AS "firstName", 'Member'::text AS "lastName",
      'MEMBER'::text AS role, 'APPROVED'::text AS "membershipStatus",
      'cs'::text AS language, true AS "isActive", CURRENT_TIMESTAMP AS "createdAt"
      WHERE to_regclass('public."User"') IS NOT NULL`;
    return rows[0] ?? null;
  },
  comparePassword: (password, hash) => bcrypt.compare(password,hash),
});
const diagnostics = makeWorker({
  checkDatabase: async connectionString => {
    const sql = connect(connectionString);
    const rows = await sql`SELECT 1 AS ok, to_regclass('public."User"') IS NOT NULL AS schema_ok`;
    return rows.length === 1 && Number(rows[0].ok) === 1 && rows[0].schema_ok === true;
  },
  benchmarkBcrypt: async () => {
    const hash = await bcrypt.hash('ucfr-lab-fixture-not-a-password', 12);
    return bcrypt.getRounds(hash) === 12;
  },
});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!isPreviewOrigin(url)) return new Response(null, { status: 404 });
    const { pathname } = url;
    if (pathname === '/health' || pathname === '/diagnostics' || pathname.startsWith('/diagnostics/') || pathname.startsWith('/lab/')) {
      const labEnabled = ![env.DATABASE_URL, env.TOKEN_SECRET, env.BREVO_API_KEY, env.UCFR_PREVIEW_TOKEN].some(Boolean);
      if (pathname !== '/health' && !labEnabled) return new Response(null, { status: 404 });
      const lab = { LAB_TOKEN: env.LAB_TOKEN, LAB_DATABASE_URL: env.LAB_DATABASE_URL, CF_VERSION_METADATA: env.CF_VERSION_METADATA, labEnabled };
      return (await authPilot(request, lab)) ?? diagnostics.fetch(request, lab);
    }
    return serveSite(request, env, { previewOnly: true });
  },
};
