(() => {
  'use strict';

  const MIN_REFRESH_GAP_MS = 12 * 60 * 60 * 1000;
  const STORAGE_KEY = 'ucfr-public-member-count';

  let latestApprovedCount = null;
  let lastRefreshAt = 0;
  let refreshInFlight = null;

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const count = Number(cached?.count);
    const updatedAt = Number(cached?.updatedAt);
    if (Number.isFinite(count) && count >= 0 && Number.isFinite(updatedAt)) {
      latestApprovedCount = count;
      lastRefreshAt = updatedAt;
    }
  } catch {}

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
        if (Number.isFinite(count) && count >= 0) {
          latestApprovedCount = count;
          lastRefreshAt = Date.now();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ count, updatedAt: lastRefreshAt }));
          } catch {}
        }
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
    refreshCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
