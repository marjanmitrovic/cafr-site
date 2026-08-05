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

  const upstreamRequest = new Request(target, {
    method,
    headers: forwardedHeaders(request, target),
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  try {
    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);

    // API and uploaded user content must never be cached at the edge.
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('UČFR Render proxy error:', error);

    return Response.json(
      {
        error: 'Server členské sekce se právě spouští nebo je dočasně nedostupný. Zkuste požadavek znovu přibližně za jednu minutu.',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      },
    );
  }
}
