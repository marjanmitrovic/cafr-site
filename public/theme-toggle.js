(() => {
  'use strict';

  const STORAGE_KEY = 'ucfr-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) === DARK ? DARK : LIGHT;
  }

  function labelFor(theme) {
    const english = document.documentElement.lang === 'en';
    if (theme === DARK) return english ? 'Switch to light mode' : 'Přepnout na světlý režim';
    return english ? 'Switch to dark mode' : 'Přepnout na tmavý režim';
  }

  function updateButtons(theme) {
    const label = labelFor(theme);
    const icon = theme === DARK ? '☀' : '☾';

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(theme === DARK));
      button.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${icon}</span>`;
    });
  }

  function applyTheme(theme, persist = true) {
    const next = theme === DARK ? DARK : LIGHT;
    const root = document.documentElement;

    root.dataset.theme = next;
    root.classList.toggle('theme-dark', next === DARK);
    root.classList.toggle('theme-light', next === LIGHT);

    if (persist) localStorage.setItem(STORAGE_KEY, next);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === DARK ? '#08131f' : '#ffffff';

    updateButtons(next);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-theme-toggle]');
    if (!button) return;

    event.preventDefault();
    const current = document.documentElement.dataset.theme || getTheme();
    applyTheme(current === DARK ? LIGHT : DARK);
  });

  applyTheme(getTheme(), false);

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme(), false);
  }, { once: true });
})();