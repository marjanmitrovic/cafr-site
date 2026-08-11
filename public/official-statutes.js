(() => {
  'use strict';

  const HIDDEN_STATUTE_PATHS = new Set([
    '/documents/Stanovy_CAFR_aktualizovane.pdf',
    '/documents/Stanovy_CAFR_navrh.pdf',
  ]);

  function removeStatuteLinks() {
    for (const link of document.querySelectorAll('a[href]')) {
      try {
        const pathname = new URL(link.getAttribute('href'), window.location.origin).pathname;
        if (HIDDEN_STATUTE_PATHS.has(pathname)) {
          link.remove();
        }
      } catch {
        // Ignore malformed URLs.
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeStatuteLinks, { once: true });
  } else {
    removeStatuteLinks();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#langBtn')) {
      window.setTimeout(removeStatuteLinks, 0);
      window.setTimeout(removeStatuteLinks, 100);
    }
  });

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      removeStatuteLinks();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
