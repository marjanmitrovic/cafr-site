(() => {
  'use strict';

  // Restore the original horizontal UČFR logo used before the SVG override.
  const LOGO_URL = '/assets/ucfr-logo.jpg?v=18';

  function collectLogos(root = document) {
    const logos = [];
    const selectors = [
      '.topbar .brand img',
      '.footer-brand img',
      '.member-card img:not(.member-qr)',
      '.profile-member-card img:not(.member-qr)',
      'img[alt="UČFR"]',
      'img[alt="UČFR logo"]'
    ];

    for (const selector of selectors) {
      if (root.matches?.(selector)) logos.push(root);
      root.querySelectorAll?.(selector).forEach((logo) => logos.push(logo));
    }

    return [...new Set(logos)];
  }

  function applyLogo(root = document) {
    collectLogos(root).forEach((logo) => {
      if (logo.getAttribute('src') !== LOGO_URL) logo.setAttribute('src', LOGO_URL);
      logo.hidden = false;
      logo.style.removeProperty('visibility');
      logo.style.removeProperty('opacity');
    });
  }

  applyLogo();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) applyLogo(node);
      });
    }
    applyLogo();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
