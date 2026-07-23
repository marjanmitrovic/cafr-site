(() => {
  'use strict';

  const STORAGE_KEY = 'ucfr-theme';
  const LEGACY_KEY = 'cafr-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

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
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const label = isEnglish()
        ? (dark ? 'Light mode' : 'Dark mode')
        : (dark ? 'Světlý režim' : 'Tmavý režim');
      button.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${dark ? '☀' : '☾'}</span><span class="theme-toggle-label">${label}</span>`;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(dark));
    });
  }

  function applyTheme(theme, persist = true) {
    const next = theme === DARK ? DARK : LIGHT;
    document.documentElement.classList.toggle('theme-dark', next === DARK);
    document.documentElement.classList.toggle('theme-light', next === LIGHT);
    document.documentElement.dataset.theme = next;
    if (persist) {
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.removeItem(LEGACY_KEY);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === DARK ? '#07111f' : '#0b2a55';
    updateButtons(next);
  }

  function toggleTheme() {
    applyTheme(document.documentElement.classList.contains('theme-dark') ? LIGHT : DARK);
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

  function addHomepageButton() {
    const actions = document.querySelector('.topbar .actions');
    if (!actions) return false;
    if (!document.getElementById('siteThemeToggle')) actions.prepend(createButton('siteThemeToggle', 'site-theme-toggle'));
    updateButtons(storedTheme());
    return true;
  }

  function addDashboardButton() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    if (!sidebar) return false;
    if (!document.getElementById('dashboardThemeToggle')) {
      const button = createButton('dashboardThemeToggle', 'dashboard-theme-toggle');
      const top = document.querySelector('.dashboard-mobile-top');
      if (top) top.insertBefore(button, top.querySelector('.dashboard-mobile-logout'));
      else sidebar.insertBefore(button, sidebar.querySelector('.dashboard-nav'));
    }
    updateButtons(storedTheme());
    return true;
  }

  applyTheme(storedTheme(), false);

  if (!addHomepageButton() || !addDashboardButton()) {
    const observer = new MutationObserver(() => {
      const homeReady = addHomepageButton();
      const dashboardReady = addDashboardButton();
      if (homeReady && dashboardReady) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 12000);
  }
})();
