(() => {
  'use strict';

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
  }

  function ensureStyles() {
    if (document.getElementById('ucfrPublicStatsLayoutStyles')) return;
    const style = document.createElement('style');
    style.id = 'ucfrPublicStatsLayoutStyles';
    style.textContent = `
      #home .stats .ucfr-region-district-stat {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 22px;
        align-items: start;
      }
      #home .stats .ucfr-region-district-stat > span {
        display: flex;
        flex-direction: column;
      }
      #home .stats .ucfr-region-district-stat b {
        font-size: 26px;
        color: #fff;
        line-height: 1.15;
      }
      #home .stats .ucfr-region-district-stat small {
        font-size: 12px;
        color: #aabfd4;
        line-height: 1.35;
      }
      @media (max-width: 720px) {
        #home .stats .ucfr-region-district-stat {
          gap: 18px;
        }
        #home .stats .ucfr-region-district-stat b {
          font-size: 26px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    ensureStyles();
    const stats = document.querySelector('#home .stats');
    if (!stats) return;

    const items = [...stats.children];
    const regions = items.find((item) => /krajů|regions|okresů|districts/i.test(item.textContent || ''));
    if (!regions) return;

    const oldDistrict = stats.querySelector('[data-public-stat="districts"]');
    if (oldDistrict && oldDistrict !== regions) oldDistrict.remove();

    regions.classList.add('ucfr-region-district-stat');
    regions.dataset.publicStat = 'regions-districts';
    const cs = language() === 'cs';
    regions.innerHTML = `
      <span><b>14</b><small>${cs ? 'krajů' : 'regions'}</small></span>
      <span><b>76</b><small>${cs ? 'okresů' : 'districts'}</small></span>
    `;
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
