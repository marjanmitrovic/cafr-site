(() => {
  function addFotbaltestyLink() {
    const nav = document.querySelector('.dashboard-nav');
    if (!nav) return false;

    if (document.getElementById('fotbaltesty-link')) return true;

    const link = document.createElement('a');
    link.id = 'fotbaltesty-link';
    link.className = 'dashboard-external-link dashboard-fotbaltesty-link';
    link.href = 'https://fotbaltesty.22web.org';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Otevřít aplikaci Fotbaltesty';
    link.textContent = 'Fotbaltesty ↗';
    nav.insertBefore(link, nav.children[3] || null);

    return true;
  }

  if (!addFotbaltestyLink()) {
    const observer = new MutationObserver(() => {
      if (addFotbaltestyLink()) observer.disconnect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();