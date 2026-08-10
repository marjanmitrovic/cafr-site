(() => {
  'use strict';

  function isCzech() {
    return document.documentElement.lang !== 'en';
  }

  function ensureStyles() {
    if (document.getElementById('ucfrLocalUnitsCollapseStyles')) return;

    const style = document.createElement('style');
    style.id = 'ucfrLocalUnitsCollapseStyles';
    style.textContent = `
      #local-units.local-units-section {
        padding-top: 30px !important;
        padding-bottom: 30px !important;
      }
      #local-units .section-head {
        width: min(820px, calc(100% - 36px));
        margin: 0 auto 14px !important;
        text-align: center;
      }
      #local-units .section-head h2 {
        margin: 5px 0 0 !important;
        font-size: clamp(26px, 3vw, 34px) !important;
        line-height: 1.15 !important;
      }
      #local-units:not(.local-units-open) .section-head p,
      #local-units:not(.local-units-open) .local-units-grid {
        display: none !important;
      }
      #local-units .local-units-toggle {
        width: min(620px, calc(100% - 36px));
        min-height: 52px;
        margin: 0 auto;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border: 1px solid #cbd9e8;
        border-radius: 14px;
        background: #fff;
        color: #102b4c;
        box-shadow: 0 8px 22px rgba(16, 42, 77, .07);
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      #local-units .local-units-toggle:hover,
      #local-units .local-units-toggle:focus-visible {
        border-color: #0b5aa5;
        outline: none;
      }
      #local-units .local-units-toggle-arrow {
        flex: 0 0 auto;
        font-size: 20px;
        line-height: 1;
        transition: transform .2s ease;
      }
      #local-units .local-units-toggle[aria-expanded="true"] .local-units-toggle-arrow {
        transform: rotate(180deg);
      }
      #local-units.local-units-open .section-head p {
        margin-top: 12px !important;
      }
      #local-units .local-units-grid {
        margin-top: 22px !important;
      }
      html.theme-dark #local-units .local-units-toggle {
        border-color: #3b5068;
        background: #0f1f31;
        color: #f4f7fb;
        box-shadow: none;
      }
      @media (max-width: 640px) {
        #local-units.local-units-section {
          padding-top: 22px !important;
          padding-bottom: 22px !important;
        }
        #local-units .section-head {
          width: calc(100% - 32px);
          margin-bottom: 12px !important;
        }
        #local-units .section-head h2 {
          font-size: 25px !important;
        }
        #local-units .section-head span {
          font-size: 11px !important;
          letter-spacing: .14em !important;
        }
        #local-units .local-units-toggle {
          width: calc(100% - 32px);
          min-height: 50px;
          padding: 11px 14px;
          text-align: left;
        }
        #local-units .local-units-grid {
          margin-top: 16px !important;
          padding-inline: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function label(count, open) {
    if (isCzech()) {
      return open
        ? 'Skrýt organizační jednotky'
        : `Zobrazit organizační jednotky${count ? ` (${count})` : ''}`;
    }

    return open
      ? 'Hide organizational units'
      : `Show organizational units${count ? ` (${count})` : ''}`;
  }

  function applyState(section) {
    const grid = section.querySelector('.local-units-grid');
    const toggle = section.querySelector(':scope > .local-units-toggle');
    if (!grid || !toggle) return;

    const count = grid.querySelectorAll('.local-unit-card').length;
    const open = section.dataset.localUnitsOpen === '1';

    section.classList.toggle('local-units-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-controls', 'localUnitsGrid');
    grid.id = 'localUnitsGrid';

    const labelNode = toggle.querySelector('.local-units-toggle-label');
    const nextLabel = label(count, open);
    if (labelNode && labelNode.textContent !== nextLabel) labelNode.textContent = nextLabel;
  }

  function enhance() {
    ensureStyles();

    const section = document.getElementById('local-units');
    if (!section) return;

    const grid = section.querySelector('.local-units-grid');
    const head = section.querySelector('.section-head');
    if (!grid || !head) return;

    if (!section.dataset.localUnitsOpen) section.dataset.localUnitsOpen = '0';

    let toggle = section.querySelector(':scope > .local-units-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'local-units-toggle';
      toggle.innerHTML = '<span class="local-units-toggle-label"></span><span class="local-units-toggle-arrow" aria-hidden="true">⌄</span>';
      head.insertAdjacentElement('afterend', toggle);
    }

    applyState(section);
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('#local-units > .local-units-toggle');
    if (!toggle) return;

    const section = toggle.closest('#local-units');
    if (!section) return;

    section.dataset.localUnitsOpen = section.dataset.localUnitsOpen === '1' ? '0' : '1';
    applyState(section);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance, { once: true });
  } else {
    enhance();
  }

  let frame = 0;
  const observer = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      enhance();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#langBtn')) setTimeout(enhance, 80);
  }, true);
})();
