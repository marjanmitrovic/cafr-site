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

  const membershipStatuses = [
    { value: 'ALL', cs: 'Všechny stavy', en: 'All statuses' },
    { value: 'PENDING', cs: 'Čeká na schválení', en: 'Pending approval' },
    { value: 'APPROVED', cs: 'Schválený', en: 'Approved' },
    { value: 'REJECTED', cs: 'Zamítnutý', en: 'Rejected' },
    { value: 'SUSPENDED', cs: 'Pozastavený', en: 'Suspended' },
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

  function cardStatus(card) {
    return String(card.querySelector('[data-user-status]')?.value || '').trim().toUpperCase();
  }

  function statusLabel(value) {
    const item = membershipStatuses.find((status) => status.value === value);
    return item ? (isCzech() ? item.cs : item.en) : value;
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

    const regionField = document.createElement('label');
    regionField.className = 'admin-member-region-field';
    regionField.innerHTML = `
      <span>${isCzech() ? 'Kraj' : 'Region'}</span>
      <select class="admin-member-region-select">
        <option value="ALL">${isCzech() ? 'Všechny kraje' : 'All regions'}</option>
        ${allRegions.map((region) => `<option value="${region.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${region}</option>`).join('')}
      </select>
    `;

    const statusField = document.createElement('label');
    statusField.className = 'admin-member-status-field';
    statusField.innerHTML = `
      <span>${isCzech() ? 'Stav členství' : 'Membership status'}</span>
      <select class="admin-member-status-select">
        ${membershipStatuses.map((status) => `
          <option value="${status.value}">${isCzech() ? status.cs : status.en}</option>
        `).join('')}
      </select>
    `;

    const sortField = toolbar.querySelector('.admin-member-sort-field');
    toolbar.insertBefore(regionField, sortField || toolbar.querySelector('.admin-member-filter-result'));
    toolbar.insertBefore(statusField, sortField || toolbar.querySelector('.admin-member-filter-result'));

    const regionSelect = regionField.querySelector('.admin-member-region-select');
    const statusSelect = statusField.querySelector('.admin-member-status-select');
    const searchInput = toolbar.querySelector('.admin-member-search-input');
    const sortSelect = toolbar.querySelector('.admin-member-sort-select');
    const result = toolbar.querySelector('.admin-member-filter-result');

    const applyFilters = () => {
      const selectedRegion = regionSelect.value;
      const selectedStatus = statusSelect.value;
      const normalizedRegion = normalize(selectedRegion);
      const cards = [...list.querySelectorAll(':scope > .admin-member-card')]
        .filter((card) => card.querySelector('[data-user-status], [data-user-role]'));

      cards.forEach((card) => {
        const matchesRegion = selectedRegion === 'ALL' || normalize(cardRegion(card)) === normalizedRegion;
        const matchesStatus = selectedStatus === 'ALL' || cardStatus(card) === selectedStatus;
        card.classList.toggle('admin-region-filtered-out', !matchesRegion);
        card.classList.toggle('admin-status-filtered-out', !matchesStatus);
      });

      const visible = cards.filter((card) =>
        !card.classList.contains('admin-search-filtered-out') &&
        !card.classList.contains('admin-region-filtered-out') &&
        !card.classList.contains('admin-status-filtered-out')
      ).length;

      const details = [];
      if (selectedRegion !== 'ALL') details.push(selectedRegion);
      if (selectedStatus !== 'ALL') details.push(statusLabel(selectedStatus));
      const detailText = details.length ? ` · ${details.join(' · ')}` : '';

      if (result) {
        result.textContent = isCzech()
          ? `Zobrazeno ${visible} z ${cards.length} členů${detailText} · čekající vždy první`
          : `Showing ${visible} of ${cards.length} members${detailText} · pending always first`;
      }

      const empty = list.querySelector(':scope > .admin-member-filter-empty');
      if (empty) empty.hidden = visible !== 0;
    };

    regionSelect.addEventListener('change', applyFilters);
    statusSelect.addEventListener('change', applyFilters);
    searchInput?.addEventListener('input', () => window.setTimeout(applyFilters, 0));
    searchInput?.addEventListener('search', () => window.setTimeout(applyFilters, 0));
    sortSelect?.addEventListener('change', () => window.setTimeout(applyFilters, 0));
    list.addEventListener('change', (event) => {
      if (event.target.matches('[data-user-status], [data-user-role]')) {
        window.setTimeout(applyFilters, 0);
      }
    });

    const listObserver = new MutationObserver(() => window.setTimeout(applyFilters, 0));
    listObserver.observe(list, { childList: true, subtree: false });

    applyFilters();
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