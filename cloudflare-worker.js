import { proxyToRender } from './functions/_shared/render-proxy.js';

function shouldProxy(pathname) {
  return pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/uploads' ||
    pathname.startsWith('/uploads/');
}

function edgeHealth(env) {
  return Response.json(
    {
      ok: true,
      service: 'ucfr-cloudflare-edge',
      backendOrigin: String(env?.UCFR_BACKEND_ORIGIN || ''),
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/edge-health') {
      return edgeHealth(env);
    }

    if (shouldProxy(url.pathname)) {
      return proxyToRender({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
