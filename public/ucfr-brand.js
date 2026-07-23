(() => {
  'use strict';

  const LOGO_PATH = '/assets/ucfr-logo.png?v=5';

  function updateLogos(root = document) {
    root.querySelectorAll?.('img[src*="ucfr-logo."]').forEach((image) => {
      if (image.getAttribute('src') !== LOGO_PATH) image.setAttribute('src', LOGO_PATH);
      image.hidden = false;
      image.style.opacity = '1';
      image.style.visibility = 'visible';
    });

    root.querySelectorAll?.('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
      link.setAttribute('href', LOGO_PATH);
      link.setAttribute('type', 'image/png');
    });
  }

  function apply() {
    updateLogos();
    window.UCFRMemberCards = window.CAFRMemberCards || window.UCFRMemberCards;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  window.setTimeout(apply, 300);
})();
