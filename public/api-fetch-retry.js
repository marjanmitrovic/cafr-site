(() => {
  'use strict';

  const originalFetch = window.fetch.bind(window);
  const RETRY_DELAYS_MS = [500, 1500];

  function isApiGetRequest(input, init = {}) {
    const request = input instanceof Request ? input : null;
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    if (method !== 'GET') return false;

    try {
      const url = new URL(request?.url || String(input), window.location.href);
      return url.origin === window.location.origin && url.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  }

  function isTransientAbort(error) {
    const name = String(error?.name || '');
    const message = String(error?.message || '').toLowerCase();

    return name === 'AbortError' ||
      message.includes('signal is aborted') ||
      message.includes('signal was aborted') ||
      message.includes('aborted without reason');
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  window.fetch = async function ucfrFetchWithRetry(input, init = {}) {
    if (!isApiGetRequest(input, init)) {
      return originalFetch(input, init);
    }

    let lastError;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await originalFetch(input, init);
      } catch (error) {
        lastError = error;

        if (!isTransientAbort(error) || attempt === RETRY_DELAYS_MS.length) {
          throw error;
        }

        await delay(RETRY_DELAYS_MS[attempt]);
      }
    }

    throw lastError;
  };
})();
