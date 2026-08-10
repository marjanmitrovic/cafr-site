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
        padding-top: 46px !important;
        padding-bottom: 46px !important;
      }
      #local-units .section-head {
        margin-bottom: 18px !important;
      }
      #local-units .section-head h2 {
        margin-bottom: 8px !important;
        font-size: clamp(30px, 4vw, 46px) !important;
      }
      #local-units .local-units-toggle {
        width: min(720px, calc(100% - 32px));
        min-height: 56px;
        margin: 8px auto 0;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border: 1px solid #cbd9e8;
        border-radius: 14px;
        background: #ffffff;
        color: #102b4c;
        box-shadow: 0 8px 24px rgba(16, 42, 77, .07);
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      #local-units .local-units-toggle:hover,
      #local-units .local-units-toggle:focus-visible {
        border-color: #0b5aa5;
      }
      #local-units .local-units-toggle-arrow {
        flex: 0 0 auto;
        font-size: 22px;
        line-height: 1;
        transition: transform .2s ease;
      }
      #local-units .local-units-toggle[aria-expanded="true"] .local-units-toggle-arrow {
        transform: rotate(180deg);
      }
      #local-units .local-units-grid[hidden] {
        display: none !important;
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
          padding-top: 30px !important;
          padding-bottom: 30px !important;
        }
        #local-units .section-head {
          padding-inline: 22px;
          margin-bottom: 14px !important;
        }
        #local-units .section-head h2 {
          margin-top: 7px !important;
          font-size: 28px !important;
          line-height: 1.12 !important;
        }
        #local-units:not(.local-units-open) .section-head p {
          display: none !important;
        }
        #local-units .section-head span {
          font-size: 12px !important;
          letter-spacing: .16em !important;
        }
        #local-units .local-units-toggle {
          width: calc(100% - 36px);
          min-height: 52px;
          margin-top: 4px;
          padding: 12px 15px;
          text-align: left;
        }
        #local-units .local-units-grid {
          margin-top: 18px !important;
          padding-inline: 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function label(count, open) {
    if (isCzech()) {
      return open
        ? `Skrýt organizační jednotky`
        : `Zobrazit organizační jednotky${count ? ` (${count})` : ''}`;
    }
    return open
      ? 'Hide organizational units'
      : `Show organizational units${count ? ` (${count})` : ''}`;
  }

  function enhance() {
    ensureStyles();
    const section = document.getElementById('local-units');
    if (!section) return;

    const grid = section.querySelector('.local-units-grid');
    const head = section.querySelector('.section-head');
    if (!grid || !head) return;

    const count = grid.querySelectorAll('.local-unit-card').length;
    const open = section.dataset.localUnitsOpen === '1';

    let toggle = section.querySelector(':scope > .local-units-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'local-units-toggle';
      head.insertAdjacentElement('afterend', toggle);
      toggle.addEventListener('click', () => {
        const nextOpen = section.dataset.localUnitsOpen !== '1';
        section.dataset.localUnitsOpen = nextOpen ? '1' : '0';
        applyState(section);
      });
    }

    toggle.innerHTML = `<span class="local-units-toggle-label"></span><span class="local-units-toggle-arrow" aria-hidden="true">⌄</span>`;
    applyState(section, count);
  }

  function applyState(section, knownCount) {
    const grid = section.querySelector('.local-units-grid');
    const toggle = section.querySelector(':scope > .local-units-toggle');
    if (!grid || !toggle) return;

    const count = Number.isFinite(knownCount)
      ? knownCount
      : grid.querySelectorAll('.local-unit-card').length;
    const open = section.dataset.localUnitsOpen === '1';

    section.classList.toggle('local-units-open', open);
    grid.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.local-units-toggle-label').textContent = label(count, open);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance, { once: true });
  } else {
    enhance();
  }

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      enhance();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#langBtn')) setTimeout(enhance, 80);
  }, true);
})();
