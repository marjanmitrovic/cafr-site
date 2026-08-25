(() => {
  'use strict';

  const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
  const MIN_REFRESH_GAP_MS = 5 * 60 * 1000;

  let latestApprovedCount = null;
  let lastRefreshAt = 0;
  let refreshInFlight = null;

  function displayCount() {
    return Number.isFinite(latestApprovedCount)
      ? String(latestApprovedCount)
      : '—';
  }

  function applyCount() {
    const stats = document.querySelector('#home .stats');
    const firstValue = stats?.querySelector('div:first-child b');
    if (!firstValue) return;
    const value = displayCount();
    if (firstValue.textContent !== value) firstValue.textContent = value;
  }

  async function refreshCount({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastRefreshAt < MIN_REFRESH_GAP_MS) {
      applyCount();
      return;
    }

    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      try {
        const response = await fetch('/api/public/member-count', {
          headers: { Accept: 'application/json' },
          cache: 'default',
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        const count = Number(data?.count);
        if (Number.isFinite(count) && count >= 0) latestApprovedCount = count;
        lastRefreshAt = Date.now();
      } catch (error) {
        console.warn('[PUBLIC MEMBER COUNT] Could not load member count:', error);
      } finally {
        refreshInFlight = null;
        applyCount();
      }
    })();

    return refreshInFlight;
  }

  function init() {
    applyCount();
    refreshCount({ force: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('pageshow', () => refreshCount());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshCount();
  });

  window.setInterval(() => refreshCount(), REFRESH_INTERVAL_MS);
})();
