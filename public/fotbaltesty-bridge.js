(() => {
  const FOTBALTESTY_URL = 'https://fotbaltesty.22web.org';

  function buildLink(className = '') {
    const link = document.createElement('a');
    link.href = FOTBALTESTY_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = className;
    link.textContent = 'Fotbaltesty ↗';
    return link;
  }

  function enhanceHomepageTests() {
    const testsSection = document.querySelector('#tests');
    if (!testsSection || document.getElementById('fotbaltesty-homepage-card')) return false;

    const grid = testsSection.querySelector('.test-mode-grid');
    if (!grid) return false;

    const card = document.createElement('article');
    card.id = 'fotbaltesty-homepage-card';
    card.className = 'test-mode-card featured fotbaltesty-card';
    card.innerHTML = `
      <div class="test-mode-icon">⚽</div>
      <h3>Fotbaltesty</h3>
      <p>Externí aplikace pro procvičování pravidel fotbalu.</p>
    `;
    card.appendChild(buildLink('primary fotbaltesty-button'));
    grid.appendChild(card);
    return true;
  }

  function enhanceDashboardNav() {
    const nav = document.querySelector('.dashboard-nav');
    if (!nav || document.getElementById('fotbaltesty-dashboard-link')) return false;

    const link = buildLink('dashboard-external-link dashboard-fotbaltesty-link');
    link.id = 'fotbaltesty-dashboard-link';
    link.title = 'Otevřít aplikaci Fotbaltesty';
    nav.insertBefore(link, nav.children[3] || null);
    return true;
  }

  function enhanceDashboardResults() {
    const panel = [...document.querySelectorAll('.dashboard-panel')]
      .find((item) => /Moje testy|Výsledky nelze načíst|Zatím nemáte uložené výsledky/.test(item.textContent || ''));

    if (!panel || document.getElementById('fotbaltesty-results-link')) return false;

    const box = document.createElement('div');
    box.id = 'fotbaltesty-results-link';
    box.className = 'fotbaltesty-results-box';
    box.innerHTML = '<h3>Fotbaltesty</h3><p>Otevřít externí aplikaci pro testy pravidel fotbalu.</p>';
    box.appendChild(buildLink('primary fotbaltesty-button'));
    panel.appendChild(box);
    return true;
  }

  function run() {
    enhanceHomepageTests();
    enhanceDashboardNav();
    enhanceDashboardResults();
  }

  run();
  const interval = window.setInterval(run, 500);
  window.setTimeout(() => window.clearInterval(interval), 20000);

  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 30000);
})();
