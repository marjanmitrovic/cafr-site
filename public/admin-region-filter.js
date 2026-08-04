(() => {
  'use strict';

  const regions = [
    'Hlavní město Praha',
    'Středočeský kraj',
    'Jihočeský kraj',
    'Plzeňský kraj',
    'Karlovarský kraj',
    'Ústecký kraj',
    'Liberecký kraj',
    'Královéhradecký kraj',
    'Pardubický kraj',
    'Kraj Vysočina',
    'Jihomoravský kraj',
    'Olomoucký kraj',
    'Zlínský kraj',
    'Moravskoslezský kraj',
  ];

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('cs-CZ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isCzech() {
    return document.documentElement.lang !== 'en';
  }

  function primaryMemberSection(shell) {
    return [...shell.querySelectorAll(':scope > .admin-panel-section')].find((section) => {
      if (section.id === 'adminMemberDirectory') return false;
      const heading = normalize(section.querySelector('h3')?.textContent);
      return /registrovani clenove|registered members/.test(heading);
    });
  }

  function cardRegion(card) {
    return String(card.querySelector('.admin-member-meta span:first-child')?.textContent || '').trim();
  }

  function enhance(shell) {
    const section = primaryMemberSection(shell);
    const toolbar = section?.querySelector(':scope > .admin-member-filterbar');
    const list = section?.querySelector(':scope > .admin-member-list');
    if (!toolbar || !list || toolbar.querySelector('.admin-member-region-select')) return;

    const legacyRegions = [...list.querySelectorAll(':scope > .admin-member-card')]
      .map(cardRegion)
      .filter((region) => region && region !== '—' && !regions.some((item) => normalize(item) === normalize(region)));

    const allRegions = [...regions, ...new Set(legacyRegions)]
      .sort((a, b) => a.localeCompare(b, 'cs', { sensitivity: 'base' }));

    const field = document.createElement('label');
    field.className = 'admin-member-region-field';
    field.innerHTML = `
      <span>${isCzech() ? 'Kraj' : 'Region'}</span>
      <select class="admin-member-region-select">
        <option value="ALL">${isCzech() ? 'Všechny kraje' : 'All regions'}</option>
        ${allRegions.map((region) => `<option value="${region.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${region}</option>`).join('')}
      </select>
    `;

    const sortField = toolbar.querySelector('.admin-member-sort-field');
    toolbar.insertBefore(field, sortField || toolbar.querySelector('.admin-member-filter-result'));

    const select = field.querySelector('.admin-member-region-select');
    const searchInput = toolbar.querySelector('.admin-member-search-input');
    const sortSelect = toolbar.querySelector('.admin-member-sort-select');
    const result = toolbar.querySelector('.admin-member-filter-result');

    const applyRegion = () => {
      const selected = select.value;
      const normalizedSelected = normalize(selected);
      const cards = [...list.querySelectorAll(':scope > .admin-member-card')]
        .filter((card) => card.querySelector('[data-user-status], [data-user-role]'));

      cards.forEach((card) => {
        const matchesRegion = selected === 'ALL' || normalize(cardRegion(card)) === normalizedSelected;
        card.classList.toggle('admin-region-filtered-out', !matchesRegion);
      });

      const visible = cards.filter((card) => !card.hidden && !card.classList.contains('admin-region-filtered-out')).length;
      const regionText = selected === 'ALL' ? '' : ` · ${selected}`;
      if (result) {
        result.textContent = isCzech()
          ? `Zobrazeno ${visible} z ${cards.length} členů${regionText} · čekající vždy první`
          : `Showing ${visible} of ${cards.length} members${regionText} · pending always first`;
      }

      let empty = list.querySelector(':scope > .admin-member-filter-empty');
      if (empty) empty.hidden = visible !== 0;
    };

    select.addEventListener('change', applyRegion);
    searchInput?.addEventListener('input', () => window.setTimeout(applyRegion, 0));
    sortSelect?.addEventListener('change', () => window.setTimeout(applyRegion, 0));
    list.addEventListener('change', () => window.setTimeout(applyRegion, 0));

    const listObserver = new MutationObserver(() => window.setTimeout(applyRegion, 0));
    listObserver.observe(list, { childList: true, subtree: false });

    applyRegion();
  }

  function scan(root = document) {
    if (root.matches?.('.admin-shell')) enhance(root);
    root.querySelectorAll?.('.admin-shell').forEach(enhance);
  }

  scan();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
