(() => {
  'use strict';

  const MARKER_RE = /\s*\[UCFR_EXTERNAL_URL:([^\]]+)\]\s*$/i;
  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001'
      : window.location.origin);

  let publicExternalById = new Map();
  let adminDocsCache = null;

  function token() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function normalizeExternalUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      [...url.searchParams.keys()].forEach((key) => {
        if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) {
          url.searchParams.delete(key);
        }
      });
      return url.toString();
    } catch {
      return '';
    }
  }

  function externalFromText(value) {
    const match = String(value || '').match(MARKER_RE);
    return match ? normalizeExternalUrl(match[1]) : '';
  }

  function stripMarker(value) {
    return String(value || '').replace(MARKER_RE, '').trim();
  }

  function sourceLabel(value) {
    try {
      const host = new URL(value).hostname.replace(/^www\./, '');
      const first = host.split('.')[0] || host;
      return first ? first.charAt(0).toUpperCase() + first.slice(1) : host;
    } catch {
      return 'externím webu';
    }
  }

  function ensureStyles() {
    if (document.getElementById('ucfrExternalNewsStyles')) return;
    const style = document.createElement('style');
    style.id = 'ucfrExternalNewsStyles';
    style.textContent = `
      .admin-news-external-help { display:block; margin-top:5px; color:#64748b; font-size:12px; }
      .admin-news-external-badge { display:inline-flex; align-items:center; margin-left:8px; padding:3px 8px; border-radius:999px; background:#e7f1ff; color:#0b5aa5; font-size:11px; font-weight:800; }
      .ucfr-news-external-link { display:inline-flex; align-items:center; gap:4px; text-decoration:none; }
      .ucfr-news-external-link:hover, .ucfr-news-external-link:focus-visible { text-decoration:underline; }
      html.theme-dark .admin-news-external-help { color:#aebed2; }
    `;
    document.head.appendChild(style);
  }

  function ensureAdminField() {
    const form = document.querySelector('#adminNewsForm');
    if (!form || form.querySelector('[name="externalUrl"]')) return;

    const textArea = form.querySelector('[name="text"]');
    const textLabel = textArea?.closest('label');
    if (!textLabel) return;

    const label = document.createElement('label');
    label.innerHTML = `
      Externí odkaz <span style="font-weight:500">(volitelné)</span>
      <input name="externalUrl" type="url" inputmode="url" placeholder="https://...">
      <small class="admin-news-external-help">Pokud je odkaz vyplněn, tlačítko v Aktualitách otevře původní článek na externím webu v nové kartě.</small>
    `;
    textLabel.after(label);
  }

  async function getAdminDocuments(force = false) {
    if (adminDocsCache && !force) return adminDocsCache;
    const auth = token();
    if (!auth) return [];
    try {
      const response = await fetch(`${API_BASE}/api/admin/documents`, {
        headers: { Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => []);
      adminDocsCache = response.ok && Array.isArray(data) ? data : [];
      return adminDocsCache;
    } catch {
      return [];
    }
  }

  async function fillExternalField(articleId) {
    const form = document.querySelector('#adminNewsForm');
    const input = form?.querySelector('[name="externalUrl"]');
    if (!input) return;
    const docs = await getAdminDocuments(true);
    const article = docs.find((item) => String(item.id) === String(articleId));
    input.value = externalFromText(article?.descriptionEn || '');
  }

  function decorateAdminCards() {
    const list = document.querySelector('#adminNewsList');
    if (!list || !adminDocsCache) return;
    list.querySelectorAll('[data-news-edit]').forEach((button) => {
      const article = adminDocsCache.find((item) => String(item.id) === String(button.dataset.newsEdit));
      const externalUrl = externalFromText(article?.descriptionEn || '');
      const heading = button.closest('.admin-member-card')?.querySelector('.admin-news-preview h4');
      if (!heading) return;
      heading.querySelector('.admin-news-external-badge')?.remove();
      if (externalUrl) {
        const badge = document.createElement('span');
        badge.className = 'admin-news-external-badge';
        badge.textContent = `EXTERNÍ · ${sourceLabel(externalUrl)}`;
        heading.appendChild(badge);
      }
    });
  }

  const wrappedFetch = window.fetch.bind(window);
  window.fetch = async function ucfrExternalNewsFetch(input, init = {}) {
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(String(rawUrl || ''), window.location.href);
      const method = String(init?.method || 'GET').toUpperCase();
      const isNewsWrite =
        url.origin === window.location.origin &&
        ((url.pathname === '/api/admin/documents/upload' && method === 'POST') ||
          (url.pathname.startsWith('/api/admin/news/') && method === 'PATCH'));

      if (isNewsWrite && typeof init?.body === 'string') {
        const form = document.querySelector('#adminNewsForm');
        const externalInput = form?.querySelector('[name="externalUrl"]');
        const payload = JSON.parse(init.body);
        const externalUrl = normalizeExternalUrl(externalInput?.value || '');
        const baseText = String(payload.descriptionCs ?? payload.descriptionEn ?? '').replace(MARKER_RE, '').trim();
        payload.descriptionEn = externalUrl
          ? `${baseText}\n\n[UCFR_EXTERNAL_URL:${externalUrl}]`
          : baseText;
        init = { ...init, body: JSON.stringify(payload) };
        if (externalInput && externalInput.value && !externalUrl) {
          throw new Error('Externí odkaz musí být platná adresa začínající http:// nebo https://');
        }
        adminDocsCache = null;
      }
    } catch (error) {
      if (error instanceof SyntaxError) return wrappedFetch(input, init);
      return Promise.reject(error);
    }
    return wrappedFetch(input, init);
  };

  async function refreshPublicExternalMap() {
    try {
      const response = await wrappedFetch(`${API_BASE}/api/news?externalLinks=${Date.now()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => []);
      const next = new Map();
      if (response.ok && Array.isArray(data)) {
        data.forEach((article) => {
          const externalUrl = externalFromText(article.textEn || article.descriptionEn || '');
          if (externalUrl) next.set(String(article.id), externalUrl);
        });
      }
      publicExternalById = next;
      decoratePublicCards();
    } catch {
      // Public news itself keeps working even if this optional enhancement fails.
    }
  }

  function decoratePublicCards() {
    document.querySelectorAll('.ucfr-news-card').forEach((card) => {
      const trigger = card.querySelector('[data-news-id]');
      const id = trigger?.dataset.newsId || card.querySelector('[data-news-share]')?.dataset.newsShare;
      const externalUrl = publicExternalById.get(String(id || ''));
      if (!externalUrl) return;

      const paragraph = card.querySelector('.ucfr-news-content p');
      if (paragraph) paragraph.textContent = stripMarker(paragraph.textContent);

      if (trigger && trigger.tagName !== 'A') {
        const link = document.createElement('a');
        link.className = `${trigger.className} ucfr-news-external-link`;
        link.href = externalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.dataset.newsExternalId = String(id);
        link.textContent = `${document.documentElement.lang === 'en' ? 'Read on' : 'Číst na'} ${sourceLabel(externalUrl)} ↗`;
        trigger.replaceWith(link);
      }
    });
  }

  async function shareExternal(url, button) {
    const title = button?.closest('.ucfr-news-card')?.querySelector('h3')?.textContent?.trim() || 'UČFR';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      const old = button.textContent;
      button.textContent = document.documentElement.lang === 'en' ? 'Link copied' : 'Odkaz zkopírován';
      window.setTimeout(() => { if (button.isConnected) button.textContent = old; }, 1600);
    } catch {
      window.prompt(document.documentElement.lang === 'en' ? 'Copy link:' : 'Zkopírujte odkaz:', url);
    }
  }

  document.addEventListener('click', (event) => {
    const edit = event.target.closest?.('[data-news-edit]');
    if (edit) window.setTimeout(() => fillExternalField(edit.dataset.newsEdit), 0);

    const share = event.target.closest?.('[data-news-share]');
    if (share) {
      const externalUrl = publicExternalById.get(String(share.dataset.newsShare || ''));
      if (externalUrl) {
        event.preventDefault();
        event.stopImmediatePropagation();
        shareExternal(externalUrl, share);
      }
    }
  }, true);

  document.addEventListener('reset', (event) => {
    if (event.target?.id === 'adminNewsForm') {
      window.setTimeout(() => {
        const input = event.target.querySelector('[name="externalUrl"]');
        if (input) input.value = '';
      }, 0);
    }
  });

  window.addEventListener('ucfr-news-updated', () => {
    adminDocsCache = null;
    window.setTimeout(async () => {
      await getAdminDocuments(true);
      decorateAdminCards();
      refreshPublicExternalMap();
    }, 250);
  });

  const observer = new MutationObserver(() => {
    ensureAdminField();
    decoratePublicCards();
    if (document.querySelector('#adminNewsList') && !adminDocsCache) {
      getAdminDocuments().then(decorateAdminCards);
    } else {
      decorateAdminCards();
    }
  });

  ensureStyles();
  ensureAdminField();
  getAdminDocuments().then(decorateAdminCards);
  refreshPublicExternalMap();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
