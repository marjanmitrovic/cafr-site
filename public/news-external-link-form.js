(() => {
  'use strict';

  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function sourceLabel(value) {
    try {
      const host = new URL(value).hostname.replace(/^www\./, '');
      const first = host.split('.')[0] || host;
      return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Externí web';
    } catch {
      return 'Externí web';
    }
  }

  function generatedTitle(url) {
    const source = sourceLabel(url);
    try {
      const parsed = new URL(url);
      const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (last && last.length >= 8) {
        const clean = last.charAt(0).toUpperCase() + last.slice(1);
        return clean.length > 175 ? `${clean.slice(0, 172)}…` : clean;
      }
    } catch {
      // Fall back to source name below.
    }
    return `Externí článek – ${source}`;
  }

  function syncForm(form) {
    if (!form) return;
    const external = form.querySelector('[name="externalUrl"]');
    const title = form.querySelector('[name="title"]');
    const text = form.querySelector('[name="text"]');
    if (!external || !title || !text) return;

    const hasExternal = Boolean(normalizeUrl(external.value));
    title.required = !hasExternal;
    text.required = !hasExternal;

    const titleLabel = title.closest('label');
    const textLabel = text.closest('label');
    if (titleLabel) titleLabel.style.opacity = hasExternal ? '.62' : '';
    if (textLabel) textLabel.style.opacity = hasExternal ? '.62' : '';

    title.placeholder = hasExternal
      ? 'Volitelné – při externím odkazu se doplní automaticky'
      : '';
    text.placeholder = hasExternal
      ? 'Volitelné – při externím odkazu se doplní automaticky'
      : '';
  }

  function enhanceForm(form) {
    if (!form || form.dataset.externalOptionalReady === 'true') return;
    const external = form.querySelector('[name="externalUrl"]');
    const title = form.querySelector('[name="title"]');
    const text = form.querySelector('[name="text"]');
    if (!external || !title || !text) return;

    form.dataset.externalOptionalReady = 'true';
    external.addEventListener('input', () => syncForm(form));
    external.addEventListener('change', () => syncForm(form));

    form.addEventListener('submit', () => {
      const url = normalizeUrl(external.value);
      if (!url) return;

      if (!String(title.value || '').trim()) {
        title.value = generatedTitle(url);
      }
      if (!String(text.value || '').trim()) {
        text.value = `Externí článek – celý obsah je dostupný na ${sourceLabel(url)}.`;
      }
    }, true);

    form.addEventListener('reset', () => {
      window.setTimeout(() => syncForm(form), 0);
    });

    syncForm(form);
  }

  function scan() {
    const form = document.querySelector('#adminNewsForm');
    if (form) enhanceForm(form);
  }

  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
