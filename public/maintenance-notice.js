(() => {
  'use strict';

  const NOTICE_DATE = '2026-08-05';
  const TIME_ZONE = 'Europe/Prague';

  function dateInPrague() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  if (dateInPrague() !== NOTICE_DATE) return;

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --ucfr-maintenance-height: 0px;
    }

    body.ucfr-maintenance-active {
      padding-top: var(--ucfr-maintenance-height) !important;
    }

    body.ucfr-maintenance-active .topbar {
      top: var(--ucfr-maintenance-height) !important;
    }

    #ucfrMaintenanceNotice {
      position: fixed;
      inset: 0 0 auto 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 12px 20px;
      color: #fff;
      background: #a32020;
      border-bottom: 3px solid #761414;
      box-shadow: 0 6px 20px rgba(0, 0, 0, .22);
      font-family: Inter, Arial, sans-serif;
      text-align: center;
    }

    #ucfrMaintenanceNotice .maintenance-inner {
      width: min(100%, 1080px);
      font-size: 14px;
      font-weight: 650;
      line-height: 1.45;
    }

    #ucfrMaintenanceNotice strong {
      display: inline-block;
      margin-right: 6px;
      font-weight: 900;
      letter-spacing: .02em;
    }

    @media (max-width: 720px) {
      #ucfrMaintenanceNotice {
        padding: 10px 13px;
      }

      #ucfrMaintenanceNotice .maintenance-inner {
        font-size: 12.5px;
        line-height: 1.42;
      }

      #ucfrMaintenanceNotice strong {
        display: block;
        margin: 0 0 3px;
      }
    }
  `;
  document.head.appendChild(style);

  const notice = document.createElement('aside');
  notice.id = 'ucfrMaintenanceNotice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.innerHTML = `
    <div class="maintenance-inner">
      <strong>DŮLEŽITÉ UPOZORNĚNÍ</strong>
      Dnes 5. 8. 2026 probíhá technická aktualizace webu. Web a některé členské funkce mohou být během dne dočasně nedostupné. Děkujeme za pochopení.
    </div>
  `;

  document.body.prepend(notice);
  document.body.classList.add('ucfr-maintenance-active');

  const updateHeight = () => {
    document.documentElement.style.setProperty(
      '--ucfr-maintenance-height',
      `${Math.ceil(notice.getBoundingClientRect().height)}px`
    );
  };

  updateHeight();
  window.addEventListener('resize', updateHeight, { passive: true });

  if ('ResizeObserver' in window) {
    new ResizeObserver(updateHeight).observe(notice);
  }
})();

(() => {
  'use strict';

  const PUBLIC_BASELINE = 450;
  const LIVE_COUNTER_THRESHOLD = 500;
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  let liveMemberCount = null;

  function displayedMemberCount() {
    if (Number.isInteger(liveMemberCount) && liveMemberCount > LIVE_COUNTER_THRESHOLD) {
      const locale = document.documentElement.lang === 'en' ? 'en-GB' : 'cs-CZ';
      return new Intl.NumberFormat(locale).format(liveMemberCount);
    }

    return `${PUBLIC_BASELINE}+`;
  }

  function applyPublicCopy() {
    const isCzech = document.documentElement.lang !== 'en';
    const aboutLink = document.querySelector('.topbar nav a[href="#about"]');

    if (aboutLink && isCzech && aboutLink.textContent.trim() !== 'O Unii') {
      aboutLink.textContent = 'O Unii';
    }

    const memberCounter = document.querySelector('.stats > div:first-child b');
    if (memberCounter) {
      memberCounter.textContent = displayedMemberCount();
      memberCounter.dataset.counterMode =
        Number.isInteger(liveMemberCount) && liveMemberCount > LIVE_COUNTER_THRESHOLD
          ? 'live'
          : 'baseline';
    }
  }

  async function refreshMemberCount() {
    try {
      const response = await fetch('/api/public/member-count', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) return;

      const data = await response.json();
      const count = Number(data?.count);
      liveMemberCount = Number.isInteger(count) && count >= 0 ? count : null;
      applyPublicCopy();
    } catch {
      // Keep the public baseline when the live endpoint is unavailable.
    }
  }

  const observer = new MutationObserver(applyPublicCopy);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  applyPublicCopy();
  refreshMemberCount();
  window.setInterval(refreshMemberCount, REFRESH_INTERVAL_MS);
})();
