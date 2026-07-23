(() => {
  'use strict';

  const STORAGE_KEY = 'ucfr-theme';
  const LEGACY_KEY = 'cafr-theme';
  const DARK = 'dark';
  const LIGHT = 'light';
  let refreshTimer = null;

  function storedTheme() {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (saved === DARK || saved === LIGHT) return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }

  function isEnglish() {
    return document.documentElement.lang === 'en';
  }

  function updateButtons(theme) {
    const dark = theme === DARK;
    const label = isEnglish()
      ? (dark ? 'Light mode' : 'Dark mode')
      : (dark ? 'Světlý režim' : 'Tmavý režim');
    const markup = `<span class="theme-toggle-icon" aria-hidden="true">${dark ? '☀' : '☾'}</span><span class="theme-toggle-label">${label}</span>`;

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      if (button.innerHTML !== markup) button.innerHTML = markup;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (button.getAttribute('title') !== label) button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(dark));
    });
  }

  function applyTheme(theme, persist = true) {
    const next = theme === DARK ? DARK : LIGHT;
    const root = document.documentElement;
    root.classList.toggle('theme-dark', next === DARK);
    root.classList.toggle('theme-light', next === LIGHT);
    root.dataset.theme = next;

    if (persist) {
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.removeItem(LEGACY_KEY);
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === DARK ? '#071523' : '#ffffff';
    updateButtons(next);
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || storedTheme();
    applyTheme(current === DARK ? LIGHT : DARK);
  }

  function createButton(id, className) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = `theme-toggle-btn ${className}`;
    button.dataset.themeToggle = 'true';
    button.addEventListener('click', toggleTheme);
    return button;
  }

  function ensureButtons() {
    const actions = document.querySelector('.topbar .actions');
    if (actions && !document.getElementById('siteThemeToggle')) {
      actions.prepend(createButton('siteThemeToggle', 'site-theme-toggle'));
    }

    const sidebar = document.querySelector('.dashboard-sidebar');
    if (sidebar && !document.getElementById('dashboardThemeToggle')) {
      const button = createButton('dashboardThemeToggle', 'dashboard-theme-toggle');
      const top = document.querySelector('.dashboard-mobile-top');
      const logout = document.querySelector('.dashboard-mobile-logout');
      if (top) top.insertBefore(button, logout || null);
      else sidebar.insertBefore(button, sidebar.querySelector('.dashboard-nav'));
    }

    updateButtons(document.documentElement.dataset.theme || storedTheme());
  }

  function scheduleRefresh(delay = 0) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(ensureButtons, delay);
  }

  applyTheme(storedTheme(), false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureButtons();
      scheduleRefresh(250);
      scheduleRefresh(1000);
    }, { once: true });
  } else {
    ensureButtons();
    scheduleRefresh(250);
  }

  document.addEventListener('click', () => scheduleRefresh(0));
  window.addEventListener('pageshow', () => scheduleRefresh(0));
})();