(() => {
  'use strict';

  // Public, non-critical API requests must never make the page feel stuck when
  // Render is waking up. Keep writes/login untouched; only same-origin GET /api
  // calls without an existing AbortSignal receive a short timeout.
  // The legacy admin screen used to request every member at once. Redirect that
  // single GET to the paginated endpoint so opening Administrace never waits for
  // hundreds or thousands of member records.
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function ucfrFetchWithPublicTimeout(input, init = {}) {
    try {
      const method = String(init?.method || 'GET').toUpperCase();
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(String(rawUrl || ''), window.location.href);
      const isSameOriginApi = url.origin === window.location.origin && url.pathname.startsWith('/api/');
      const isLegacyAdminUsers = method === 'GET' && isSameOriginApi && url.pathname === '/api/admin/users' && !url.search;

      let requestInput = input;
      if (isLegacyAdminUsers) {
        const pagedUrl = new URL('/api/admin/users-page', window.location.origin);
        pagedUrl.searchParams.set('page', '1');
        pagedUrl.searchParams.set('limit', '50');
        requestInput = pagedUrl.toString();
      }

      if (method !== 'GET' || !isSameOriginApi || init?.signal) {
        return nativeFetch(requestInput, init);
      }

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      const response = await nativeFetch(requestInput, { ...init, signal: controller.signal })
        .finally(() => window.clearTimeout(timer));

      if (!isLegacyAdminUsers || !response.ok) return response;

      const data = await response.json().catch(() => ({}));
      const body = JSON.stringify(Array.isArray(data.users) ? data.users : []);
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      return new Response(body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return nativeFetch(input, init);
    }
  };
})();

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
      top: 0 !important;
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

  if (!document.querySelector('link[data-ucfr-social-links]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/social-links.css?v=1';
    stylesheet.dataset.ucfrSocialLinks = 'true';
    document.head.appendChild(stylesheet);
  }

  if (!document.querySelector('script[data-ucfr-social-links]')) {
    const script = document.createElement('script');
    script.src = '/social-links.js?v=1';
    script.defer = true;
    script.dataset.ucfrSocialLinks = 'true';
    document.body.appendChild(script);
  }
})();
