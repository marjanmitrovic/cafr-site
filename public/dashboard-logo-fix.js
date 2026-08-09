(() => {
  'use strict';

  const LOGO_URL = '/assets/cafr-logo.png?v=17';

  function fixLogos(root = document) {
    root.querySelectorAll?.('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (/\/assets\/ucfr-logo\.png(?:\?|$)/.test(src)) {
        img.setAttribute('src', LOGO_URL);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => fixLogos(), { once: true });
  } else {
    fixLogos();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('img')) fixLogos(node.parentElement || document);
        else fixLogos(node);
      });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
