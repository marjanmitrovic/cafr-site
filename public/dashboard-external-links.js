(() => {
  function addInternalTestLink() {
    const nav = document.querySelector('.dashboard-nav');
    if (!nav) return false;

    if (document.getElementById('cafr-tests-link')) return true;

    const link = document.createElement('a');
    link.id = 'cafr-tests-link';
    link.className = 'dashboard-external-link dashboard-internal-test-link';
    link.href = '/#tests';
    link.title = 'Otevřít testy v aplikaci ČAFR';
    link.textContent = 'Fotbaltesty';
    nav.insertBefore(link, nav.children[3] || null);

    return true;
  }

  if (!addInternalTestLink()) {
    const observer = new MutationObserver(() => {
      if (addInternalTestLink()) observer.disconnect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();
