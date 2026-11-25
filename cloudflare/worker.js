import { handleAsNodeRequest } from 'cloudflare:node';
import { hasPreviewAccess, isPreviewOrigin, missingPreviewSettings, removePreviewCredentials, servePreviewPage } from './preview.js';

const publicHosts = new Set(['ucfr.cz', 'www.ucfr.cz']);
const json = (body, status) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

function databaseUrl(env, host) {
  const url = new URL(env.DATABASE_URL);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.username || !url.password) throw new Error();
  // The local integration suite uses the disposable database on the CI runner.
  if (['localhost', '127.0.0.1'].includes(host) && url.href === 'postgresql://ucfr_test:ucfr_test@127.0.0.1:5432/ucfr_test') return url.href;
  if (!url.hostname.endsWith('.neon.tech')) throw new Error();
  url.searchParams.set('sslmode', 'verify-full');
  return url.href;
}

let server;
function loadServer(env, webOrigin) {
  if (!server) {
    if (typeof env.TOKEN_SECRET !== 'string' || env.TOKEN_SECRET.length < 32 || !env.BREVO_API_KEY) throw new Error();
    process.env.WEB_ORIGIN = webOrigin;
    process.env.TOKEN_SECRET = env.TOKEN_SECRET;
    process.env.UCFR_DB_BCRYPT = 'true';
    process.env.UCFR_SHARED_RESET_LIMIT = 'true';
    process.env.FILE_STORAGE = 'postgresql';
    process.env.EMAIL_DISABLED = 'false';
    process.env.UCFR_CI_MAIL = 'false';
    process.env.BREVO_API_KEY = env.BREVO_API_KEY;
    // Use the same verified sender for notifications and password recovery.
    process.env.UCFR_NOTIFICATION_PROVIDER = 'brevo';
    server = import('../experiments/cloudflare-backend/candidate/generated/boot.js');
  }
  return server;
}

export async function serveSite(request, env, { previewOnly = false } = {}) {
  const url = new URL(request.url);
  const preview = isPreviewOrigin(url);
  if (!preview && (previewOnly || !publicHosts.has(url.hostname))) return json({ error: 'Not found' }, 404);
  if (previewOnly && !['127.0.0.1', 'localhost'].includes(url.hostname) && url.origin !== env.UCFR_PREVIEW_ORIGIN) return json({ error: 'Not found' }, 404);
  if (url.pathname === '/preview') return preview ? servePreviewPage(request, env, url) : json({ error: 'Not found' }, 404);
  if (!/^\/(api|uploads)(\/|$)/.test(url.pathname)) return env.ASSETS.fetch(request);
  if (preview && !hasPreviewAccess(request, env, url.origin)) {
    return previewOnly ? json({ error: 'Unauthorized' }, 401) : json({ error: 'Not found' }, 404);
  }
  if (preview && missingPreviewSettings(env).length) return json({ error: 'Preview not configured' }, 503);
  if (url.pathname === '/api/edge-health') return json({ ok: true, service: 'ucfr-cloudflare-edge', backend: 'cloudflare-worker' }, 200);
  try {
    const db = databaseUrl(env, url.hostname);
    const { withDatabase } = await loadServer(env, previewOnly ? url.origin : 'https://ucfr.cz');
    const headers = new Headers(request.headers);
    removePreviewCredentials(headers);
    const response = await withDatabase(db, () => handleAsNodeRequest(3001, new Request(request, { headers })));
    const resultHeaders = new Headers(response.headers);
    resultHeaders.set('Cache-Control', 'no-store');
    resultHeaders.set('X-Content-Type-Options', 'nosniff');
    resultHeaders.set('X-UCFR-Backend', 'cloudflare-worker');
    return new Response(response.body, { status: response.status, headers: resultHeaders });
  } catch {
    return json({ error: 'Backend unavailable' }, 503);
  }
}

export default { fetch: (request, env) => serveSite(request, env) };
