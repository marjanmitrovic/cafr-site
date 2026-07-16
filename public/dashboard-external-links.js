(() => {
  const links = [
    {
      id: 'facr-tests-link',
      href: 'https://vzdelavani.fotbal.cz/static/home',
      label: 'FAČR testy ↗',
      title: 'Otevřít oficiální E-vzdělávání FAČR a testy z pravidel fotbalu'
    }
  ];

  function addExternalLinks() {
    const nav = document.querySelector('.dashboard-nav');
    if (!nav) return false;

    for (const item of links) {
      if (document.getElementById(item.id)) continue;
      const link = document.createElement('a');
      link.id = item.id;
      link.className = 'dashboard-external-link';
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = item.title;
      link.textContent = item.label;
      nav.appendChild(link);
    }

    return true;
  }

  if (!addExternalLinks()) {
    const observer = new MutationObserver(() => {
      if (addExternalLinks()) observer.disconnect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();
