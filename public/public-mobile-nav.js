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

  function restoreUnionLabel(root = document) {
    const links = [];
    if (root.matches?.('.topbar nav a')) links.push(root);
    root.querySelectorAll?.('.topbar nav a').forEach((link) => links.push(link));

    links.forEach((link) => {
      if (String(link.textContent || '').trim() === 'O asociaci') {
        link.textContent = 'O Unii';
      }
    });
  }

  function bindPublicMenu() {
    restoreUnionLabel();

    const nav = getNav();
    const button = getMenuButton();
    const topbar = document.querySelector('.topbar');
    if (!nav || !button || !topbar) return false;
    if (button.dataset.publicMobileNavReady === 'true') return true;
    button.dataset.publicMobileNavReady = 'true';
    button.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');

    button.addEventListener('click', () => {
      window.setTimeout(() => {
        restoreUnionLabel();
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

  bindPublicMenu();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        restoreUnionLabel(node);
      });
    }
    bindPublicMenu();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
