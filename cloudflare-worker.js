import { proxyToRender } from './functions/_shared/render-proxy.js';

function shouldProxy(pathname) {
  return pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/uploads' ||
    pathname.startsWith('/uploads/');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (shouldProxy(url.pathname)) {
      return proxyToRender({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
