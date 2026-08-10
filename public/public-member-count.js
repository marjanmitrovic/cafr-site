(() => {
  'use strict';

  const PUBLIC_FLOOR = 600;
  let latestApprovedCount = null;
  let refreshTimer = null;

  function displayCount() {
    const actual = Number.isFinite(latestApprovedCount) ? latestApprovedCount : 0;
    return `${Math.max(PUBLIC_FLOOR, actual)}+`;
  }

  function applyCount() {
    const stats = document.querySelector('#home .stats');
    const firstValue = stats?.querySelector('div:first-child b');
    if (!firstValue) return;
    const value = displayCount();
    if (firstValue.textContent !== value) firstValue.textContent = value;
  }

  async function refreshCount() {
    try {
      const response = await fetch(`/api/public/member-count?ts=${Date.now()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      const count = Number(data?.count);
      if (Number.isFinite(count) && count >= 0) latestApprovedCount = count;
    } catch (error) {
      console.warn('[PUBLIC MEMBER COUNT] Using 600+ fallback:', error);
    } finally {
      applyCount();
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshCount, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyCount();
      refreshCount();
    }, { once: true });
  } else {
    applyCount();
    refreshCount();
  }

  window.addEventListener('pageshow', refreshCount);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshCount();
  });

  const observer = new MutationObserver(() => {
    applyCount();
    scheduleRefresh();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(refreshCount, 5 * 60 * 1000);
})();
