(() => {
  'use strict';
  if (window.UCFRPublicNews) return;

  const FRESH_FOR_MS = 5 * 60 * 1000;
  let storedBase = '';
  try { storedBase = localStorage.getItem('cafr-api-base') || ''; } catch {}
  const base = storedBase ||
    (['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:3001'
      : window.location.origin);

  let articles = null;
  let freshUntil = 0;
  let retryAt = 0;
  let inFlight = null;

  function retryDelay(response) {
    const value = response.headers.get('Retry-After');
    if (value) {
      const seconds = Number(value);
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(value) - Date.now();
      if (Number.isFinite(delay) && delay > 0) return Math.max(60_000, delay);
    }
    return response.status === 429 ? FRESH_FOR_MS : 60_000;
  }

  function load(force = false) {
    if (inFlight) return inFlight;
    if (Date.now() < retryAt || (articles && !force &&
      (Date.now() < freshUntil || document.visibilityState === 'hidden'))) {
      return Promise.resolve(articles || []);
    }

    inFlight = (async () => {
      try {
        const response = await fetch(`${base}/api/news`, {
          headers: { Accept: 'application/json' },
          cache: 'default',
        });
        if (!response.ok) {
          retryAt = Date.now() + retryDelay(response);
          throw new Error(`News request failed (${response.status})`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid news response');
        articles = data;
        freshUntil = Date.now() + FRESH_FOR_MS;
        retryAt = 0;
      } catch (error) {
        retryAt = Math.max(retryAt, Date.now() + 60_000);
        console.warn('UČFR news:', error);
      }
      return articles || [];
    })().finally(() => { inFlight = null; });

    return inFlight;
  }

  window.UCFRPublicNews = { load };
})();
