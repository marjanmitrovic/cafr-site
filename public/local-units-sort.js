(() => {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('cs-CZ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hierarchyRank(name) {
    const value = normalize(name);

    // Nejvyšší úroveň: RKČ / Řídící komise pro Čechy.
    if (/\brkc\b|ridici komise.*cechy|komise pro cechy/.test(value)) return 0;

    // Okresní úroveň: OFS / okresní jednotka.
    if (/\bofs\b|okresni/.test(value)) return 2;

    // Všechny ostatní lokální jednotky jsou krajská úroveň.
    return 1;
  }

  function stableHierarchySort(entries) {
    return entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const rankDiff = hierarchyRank(a.entry.name) - hierarchyRank(b.entry.name);
        return rankDiff || a.index - b.index;
      })
      .map(({ entry }) => entry);
  }

  function sortPublicUnits() {
    const grid = document.querySelector('#local-units .local-units-grid');
    if (!grid) return;

    const cards = [...grid.querySelectorAll(':scope > .local-unit-card')];
    if (cards.length < 2) return;

    const sorted = stableHierarchySort(cards.map((card) => ({
      card,
      name: card.querySelector('h3')?.textContent || '',
    })));

    sorted.forEach(({ card }, index) => {
      grid.appendChild(card);
      const number = card.querySelector('.local-unit-number');
      if (number && number.textContent !== String(index + 1)) {
        number.textContent = String(index + 1);
      }
    });
  }

  function sortAdminUnits() {
    document.querySelectorAll('#adminLocalUnits .local-unit-admin-list').forEach((list) => {
      const cards = [...list.querySelectorAll(':scope > .local-unit-admin-card')];
      if (cards.length < 2) return;

      const sorted = stableHierarchySort(cards.map((card) => ({
        card,
        name: card.querySelector('h4')?.textContent || '',
      })));

      sorted.forEach(({ card }) => list.appendChild(card));
    });
  }

  function apply() {
    sortPublicUnits();
    sortAdminUnits();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      apply();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
