(() => {
  'use strict';

  const LOGO_URL = '/assets/ucfr-logo.svg?v=17';

  function applyLogo(root = document) {
    const logos = [];
    if (root.matches?.('.topbar .brand img')) logos.push(root);
    root.querySelectorAll?.('.topbar .brand img').forEach((logo) => logos.push(logo));

    logos.forEach((logo) => {
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
