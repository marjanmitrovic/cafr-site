(() => {
  const STORAGE_KEY = 'cafr-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  function getStoredTheme() {
    return localStorage.getItem(STORAGE_KEY) || LIGHT;
  }

  function applyTheme(theme) {
    const nextTheme = theme === DARK ? DARK : LIGHT;
    document.documentElement.classList.toggle('theme-dark', nextTheme === DARK);
    document.documentElement.classList.toggle('theme-light', nextTheme !== DARK);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    updateButtons(nextTheme);
  }

  function updateButtons(theme = getStoredTheme()) {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.textContent = theme === DARK ? '☀️ Light' : '🌙 Dark';
      button.setAttribute('aria-label', theme === DARK ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim');
    });
  }

  function toggleTheme() {
    applyTheme(getStoredTheme() === DARK ? LIGHT : DARK);
  }

  function createButton(className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theme-toggle-btn ${className}`;
    button.dataset.themeToggle = 'true';
    button.addEventListener('click', toggleTheme);
    return button;
  }

  function addHomepageButton() {
    const actions = document.querySelector('.topbar .actions');
    if (!actions || document.getElementById('siteThemeToggle')) return Boolean(actions);

    const button = createButton('site-theme-toggle');
    button.id = 'siteThemeToggle';
    actions.prepend(button);
    updateButtons();
    return true;
  }

  function addDashboardButton() {
    const top = document.querySelector('.dashboard-mobile-top');
    const sidebar = document.querySelector('.dashboard-sidebar');
    if (!sidebar || document.getElementById('dashboardThemeToggle')) return Boolean(sidebar);

    const button = createButton('dashboard-theme-toggle');
    button.id = 'dashboardThemeToggle';

    if (top) {
      const logout = top.querySelector('.dashboard-mobile-logout');
      top.insertBefore(button, logout || null);
    } else {
      sidebar.insertBefore(button, sidebar.querySelector('.dashboard-nav'));
    }

    updateButtons();
    return true;
  }

  function addButtons() {
    addHomepageButton();
    addDashboardButton();
  }

  applyTheme(getStoredTheme());

  if (!addHomepageButton() || !addDashboardButton()) {
    const observer = new MutationObserver(() => addButtons());
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  }
})();
