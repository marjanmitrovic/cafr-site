const DEFAULT_BACKEND_ORIGIN = 'https://cafr-site.onrender.com';

function backendOrigin(env) {
  return String(env?.UCFR_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, '');
}

function targetUrl(request, env) {
  const incoming = new URL(request.url);
  return new URL(`${incoming.pathname}${incoming.search}`, `${backendOrigin(env)}/`);
}

function forwardedHeaders(request, target) {
  const headers = new Headers(request.headers);

  // These headers describe the Cloudflare edge request and should not be
  // forwarded as if the browser had sent them directly to Render.
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');

  headers.set('x-forwarded-host', new URL(request.url).host);
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-ucfr-proxy-target', target.host);

  return headers;
}

export async function proxyToRender(context) {
  const { request, env } = context;
  const target = targetUrl(request, env);
  const method = request.method.toUpperCase();
  const isLogin = method === 'POST' && new URL(request.url).pathname === '/api/auth/login';
  const startedAt = Date.now();
  const traceId = crypto.randomUUID();
  const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value) ? value : null;
  const trace = (response, failure = null) => {
    if (!isLogin) return;
    const headers = response?.headers;
    console.info('[UCFR LOGIN PROXY]', JSON.stringify({
      traceId, status: response?.status ?? null, failure,
      durationMs: Date.now() - startedAt,
      edgeRay: safeId(request.headers.get('cf-ray')),
      upstreamRay: safeId(headers?.get('cf-ray')),
      renderRequestId: safeId(headers?.get('rndr-id')),
      applicationRequestId: safeId(headers?.get('X-UCFR-Request-ID')),
      application: headers?.get('X-UCFR-Response-Source') === 'api',
      challenge: headers?.get('cf-mitigated') === 'challenge',
      hibernating: headers?.get('x-render-routing') === 'hibernate-rate-limited',
    }));
  };

  const upstreamRequest = new Request(target, {
    method,
    headers: forwardedHeaders(request, target),
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    duplex: 'half',
    redirect: 'manual',
  });

  try {
    const upstreamResponse = await fetch(upstreamRequest);
    trace(upstreamResponse);

    // Render's router rejects this request before the application runs. This
    // is a sleeping Free instance, not an application login rate limit.
    if (upstreamResponse.status === 429 &&
      upstreamResponse.headers.get('x-render-routing') === 'hibernate-rate-limited') {
      const retryAfter = upstreamResponse.headers.get('Retry-After') || '10';
      const requestId = upstreamResponse.headers.get('rndr-id') || '';
      await upstreamResponse.body?.cancel().catch(() => {});
      return Response.json({
        code: 'BACKEND_WAKING_UP',
        error: 'Členská sekce se právě spouští. Vyčkejte prosím a zkuste to znovu za chvíli.',
      }, {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': retryAfter,
          'X-Content-Type-Options': 'nosniff',
          'X-UCFR-Response-Source': 'render-wakeup',
          'X-UCFR-Proxy': 'render',
          'X-UCFR-Upstream-Status': '429',
          'X-UCFR-Request-ID': requestId,
          'X-Render-Routing': 'hibernate-rate-limited',
        },
      });
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    // Identify whether a rejected request reached this proxy. A Cloudflare
    // challenge issued before the Worker runs cannot contain these headers.
    responseHeaders.set('X-UCFR-Proxy', 'render');
    if (isLogin && !responseHeaders.has('X-UCFR-Request-ID')) {
      responseHeaders.set('X-UCFR-Request-ID', traceId);
    }
    responseHeaders.set('X-UCFR-Upstream-Status', String(upstreamResponse.status));
    const mitigation = upstreamResponse.headers.get('cf-mitigated');
    if (mitigation) responseHeaders.set('X-UCFR-Upstream-Mitigated', mitigation);

    // API and uploaded user content must never be cached at the edge.
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    trace(null, 'network');
    console.error('UČFR Render proxy error:', error?.name || 'Error');

    return Response.json(
      {
        error: 'Server členské sekce se právě spouští nebo je dočasně nedostupný. Zkuste požadavek znovu přibližně za jednu minutu.',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '60',
          'X-UCFR-Proxy': 'render',
        },
      },
    );
  }
}
