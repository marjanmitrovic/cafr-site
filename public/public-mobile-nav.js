(() => {
  const AUTO_CLOSE_MS = 4500;
  let closeTimer = null;

  function getNav() {
    return document.querySelector('.topbar nav');
  }

  function getMenuButton() {
    return document.querySelector('#menuBtn');
  }

  function isOpen() {
    return getNav()?.classList.contains('open');
  }

  function clearCloseTimer() {
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  function closeMenu() {
    clearCloseTimer();
    const nav = getNav();
    const button = getMenuButton();
    if (nav) nav.classList.remove('open');
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function scheduleClose() {
    clearCloseTimer();
    if (!isOpen()) return;
    closeTimer = window.setTimeout(closeMenu, AUTO_CLOSE_MS);
  }

  function bindPublicMenu() {
    const nav = getNav();
    const button = getMenuButton();
    const topbar = document.querySelector('.topbar');
    if (!nav || !button || !topbar) return false;
    if (button.dataset.publicMobileNavReady === 'true') return true;
    button.dataset.publicMobileNavReady = 'true';
    button.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');

    button.addEventListener('click', () => {
      window.setTimeout(() => {
        const opened = isOpen();
        button.setAttribute('aria-expanded', opened ? 'true' : 'false');
        if (opened) scheduleClose();
        else clearCloseTimer();
      }, 0);
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });

    ['scroll', 'touchstart', 'pointerdown'].forEach((eventName) => {
      nav.addEventListener(eventName, () => {
        if (isOpen()) scheduleClose();
      }, { passive: true });
    });

    document.addEventListener('click', (event) => {
      if (!isOpen()) return;
      if (topbar.contains(event.target)) return;
      closeMenu();
    });

    return true;
  }

  if (!bindPublicMenu()) {
    const observer = new MutationObserver(() => {
      if (bindPublicMenu()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  }
})();
