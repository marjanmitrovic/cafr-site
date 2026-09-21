(() => {
  'use strict';

  function renumberPublicUnits() {
    const cards = document.querySelectorAll('#local-units .local-unit-card');
    cards.forEach((card, index) => {
      const number = card.querySelector('.local-unit-number');
      if (number) number.textContent = String(index + 1);
    });
  }

  function apply() {
    renumberPublicUnits();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      apply();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
