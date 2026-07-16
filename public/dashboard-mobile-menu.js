(() => {
  const MOBILE_MAX_WIDTH = 980;

  function isMobile() {
    return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
  }

  function closeMenu(sidebar) {
    sidebar.classList.remove('dashboard-menu-open');
    const button = sidebar.querySelector('#dashboardMobileMenuBtn');
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.textContent = '☰ Menu';
    }
  }

  function openMenu(sidebar) {
    sidebar.classList.add('dashboard-menu-open');
    const button = sidebar.querySelector('#dashboardMobileMenuBtn');
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.textContent = '✕ Zavřít';
    }
  }

  function enhanceDashboardMenu() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    const brand = document.querySelector('.dashboard-brand');
    const nav = document.querySelector('.dashboard-nav');
    const logout = document.querySelector('.dashboard-logout');

    if (!sidebar || !brand || !nav || !logout) return false;
    if (sidebar.dataset.mobileMenuReady === 'true') return true;
    sidebar.dataset.mobileMenuReady = 'true';

    const top = document.createElement('div');
    top.className = 'dashboard-mobile-top';

    const menuButton = document.createElement('button');
    menuButton.id = 'dashboardMobileMenuBtn';
    menuButton.className = 'dashboard-mobile-menu-btn';
    menuButton.type = 'button';
    menuButton.setAttribute('aria-controls', 'dashboardMenu');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = '☰ Menu';

    nav.id = 'dashboardMenu';

    const logoutClone = logout.cloneNode(true);
    logoutClone.classList.add('dashboard-mobile-logout');
    logoutClone.textContent = 'Odhlásit';
    logoutClone.addEventListener('click', () => logout.click());

    top.append(brand, menuButton, logoutClone);
    sidebar.prepend(top);

    menuButton.addEventListener('click', () => {
      if (sidebar.classList.contains('dashboard-menu-open')) closeMenu(sidebar);
      else openMenu(sidebar);
    });

    nav.addEventListener('click', (event) => {
      const item = event.target.closest('button, a');
      if (!item) return;
      if (isMobile()) window.setTimeout(() => closeMenu(sidebar), 120);
    });

    document.addEventListener('click', (event) => {
      if (!isMobile()) return;
      if (!sidebar.classList.contains('dashboard-menu-open')) return;
      if (sidebar.contains(event.target)) return;
      closeMenu(sidebar);
    });

    window.addEventListener('resize', () => {
      if (!isMobile()) openMenu(sidebar);
      else closeMenu(sidebar);
    });

    if (isMobile()) closeMenu(sidebar);
    else openMenu(sidebar);

    return true;
  }

  if (!enhanceDashboardMenu()) {
    const observer = new MutationObserver(() => {
      if (enhanceDashboardMenu()) observer.disconnect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();
