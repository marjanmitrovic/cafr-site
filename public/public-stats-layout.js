(() => {
  'use strict';

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
  }

  function apply() {
    const stats = document.querySelector('#home .stats');
    if (!stats) return;

    const items = [...stats.children];
    const regions = items.find((item) => /krajů|regions/i.test(item.textContent || ''));
    if (!regions) return;

    let districts = stats.querySelector('[data-public-stat="districts"]');
    if (!districts) {
      districts = document.createElement('div');
      districts.dataset.publicStat = 'districts';
      regions.insertAdjacentElement('afterend', districts);
    }

    districts.innerHTML = `<b>76</b><span>${language() === 'cs' ? 'okresů' : 'districts'}</span>`;
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

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#langBtn')) setTimeout(apply, 80);
  }, true);
})();
