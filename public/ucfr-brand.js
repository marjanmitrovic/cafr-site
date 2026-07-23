(() => {
  'use strict';

  const LOGO_PATH = '/assets/ucfr-logo.svg';

  function updateLogos(root = document) {
    root.querySelectorAll?.('img[src*="ucfr-logo.svg"]').forEach((image) => {
      if (image.getAttribute('src') !== LOGO_PATH) {
        image.setAttribute('src', LOGO_PATH);
      }
    });

    root.querySelectorAll?.('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (href.includes('ucfr-logo.svg') && href !== LOGO_PATH) {
        link.setAttribute('href', LOGO_PATH);
      }
    });
  }

  function patchCardEngine() {
    const engine = window.CAFRMemberCards;
    if (!engine || engine.__ucfrBrandPatched) return;

    const patched = Object.freeze({
      ...engine,
      __ucfrBrandPatched: true,
    });

    window.CAFRMemberCards = patched;
    window.UCFRMemberCards = patched;
  }

  function applyBrand() {
    updateLogos();
    patchCardEngine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand, { once: true });
  } else {
    applyBrand();
  }

  window.setTimeout(applyBrand, 250);
})();