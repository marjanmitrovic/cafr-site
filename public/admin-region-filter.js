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

  const duplicateModes = [
    { value: 'HIDE', cs: 'Skrýt duplicity', en: 'Hide duplicates' },
    { value: 'ALL', cs: 'Zobrazit vše', en: 'Show all' },
    { value: 'ONLY', cs: 'Pouze duplicity', en: 'Duplicates only' },
  ];

  const statusPriority = {
    APPROVED: 0,
    PENDING: 1,
    SUSPENDED: 2,
    REJECTED: 3,
  };

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

  function cardFacrId(card) {
    const text = String(card.textContent || '');
    const match = text.match(/ID\s*FAČR\s*:\s*([0-9]+)/i);
    if (!match) return '';
    return match[1].replace(/^0+(?=\d)/, '');
  }

  function statusLabel(value) {
    const item = membershipStatuses.find((status) => status.value === value);
    return item ? (isCzech() ? item.cs : item.en) : value;
  }

  function duplicateLabel(value) {
    const item = duplicateModes.find((mode) => mode.value === value);
    return item ? (isCzech() ? item.cs : item.en) : value;
  }

  function markDuplicateGroups(cards) {
    const groups = new Map();

    cards.forEach((card, index) => {
      card.classList.remove('admin-duplicate-secondary', 'admin-duplicate-group');
      delete card.dataset.duplicateFacrId;
      delete card.dataset.duplicatePrimary;

      const facrId = cardFacrId(card);
      if (!facrId) return;
      if (!groups.has(facrId)) groups.set(facrId, []);
      groups.get(facrId).push({ card, index });
    });

    groups.forEach((items, facrId) => {
      if (items.length < 2) return;

      items.sort((a, b) => {
        const priorityA = statusPriority[cardStatus(a.card)] ?? 9;
        const priorityB = statusPriority[cardStatus(b.card)] ?? 9;
        return priorityA - priorityB || a.index - b.index;
      });

      items.forEach(({ card }, index) => {
        card.classList.add('admin-duplicate-group');
        card.dataset.duplicateFacrId = facrId;
        card.dataset.duplicatePrimary = index === 0 ? 'true' : 'false';
        card.classList.toggle('admin-duplicate-secondary', index !== 0);
      });
    });
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

    const duplicateField = document.createElement('label');
    duplicateField.className = 'admin-member-duplicate-field';
    duplicateField.innerHTML = `
      <span>${isCzech() ? 'Duplicity ID FAČR' : 'FAČR ID duplicates'}</span>
      <select class="admin-member-duplicate-select">
        ${duplicateModes.map((mode) => `
          <option value="${mode.value}" ${mode.value === 'HIDE' ? 'selected' : ''}>${isCzech() ? mode.cs : mode.en}</option>
        `).join('')}
      </select>
    `;

    const sortField = toolbar.querySelector('.admin-member-sort-field');
    toolbar.insertBefore(regionField, sortField || toolbar.querySelector('.admin-member-filter-result'));
    toolbar.insertBefore(statusField, sortField || toolbar.querySelector('.admin-member-filter-result'));
    toolbar.insertBefore(duplicateField, sortField || toolbar.querySelector('.admin-member-filter-result'));

    const regionSelect = regionField.querySelector('.admin-member-region-select');
    const statusSelect = statusField.querySelector('.admin-member-status-select');
    const duplicateSelect = duplicateField.querySelector('.admin-member-duplicate-select');
    const searchInput = toolbar.querySelector('.admin-member-search-input');
    const sortSelect = toolbar.querySelector('.admin-member-sort-select');
    const result = toolbar.querySelector('.admin-member-filter-result');

    const applyFilters = () => {
      const selectedRegion = regionSelect.value;
      const selectedStatus = statusSelect.value;
      const selectedDuplicates = duplicateSelect.value;
      const normalizedRegion = normalize(selectedRegion);
      const cards = [...list.querySelectorAll(':scope > .admin-member-card')]
        .filter((card) => card.querySelector('[data-user-status], [data-user-role]'));

      markDuplicateGroups(cards);

      cards.forEach((card) => {
        const matchesRegion = selectedRegion === 'ALL' || normalize(cardRegion(card)) === normalizedRegion;
        const matchesStatus = selectedStatus === 'ALL' || cardStatus(card) === selectedStatus;
        const isDuplicateGroup = card.classList.contains('admin-duplicate-group');
        const isDuplicateSecondary = card.classList.contains('admin-duplicate-secondary');
        const matchesDuplicates = selectedDuplicates === 'ALL'
          || (selectedDuplicates === 'HIDE' && !isDuplicateSecondary)
          || (selectedDuplicates === 'ONLY' && isDuplicateGroup);

        card.classList.toggle('admin-region-filtered-out', !matchesRegion);
        card.classList.toggle('admin-status-filtered-out', !matchesStatus);
        card.classList.toggle('admin-duplicate-filtered-out', !matchesDuplicates);
      });

      const visible = cards.filter((card) =>
        !card.classList.contains('admin-search-filtered-out') &&
        !card.classList.contains('admin-region-filtered-out') &&
        !card.classList.contains('admin-status-filtered-out') &&
        !card.classList.contains('admin-duplicate-filtered-out')
      ).length;

      const duplicateIds = new Set(
        cards
          .filter((card) => card.classList.contains('admin-duplicate-group'))
          .map((card) => card.dataset.duplicateFacrId)
          .filter(Boolean)
      );

      const details = [];
      if (selectedRegion !== 'ALL') details.push(selectedRegion);
      if (selectedStatus !== 'ALL') details.push(statusLabel(selectedStatus));
      if (selectedDuplicates !== 'ALL') details.push(duplicateLabel(selectedDuplicates));
      const detailText = details.length ? ` · ${details.join(' · ')}` : '';
      const duplicateText = duplicateIds.size
        ? (isCzech() ? ` · ${duplicateIds.size} duplicitních ID FAČR` : ` · ${duplicateIds.size} duplicate FAČR IDs`)
        : '';

      if (result) {
        result.textContent = isCzech()
          ? `Zobrazeno ${visible} z ${cards.length} registrací${detailText}${duplicateText}`
          : `Showing ${visible} of ${cards.length} registrations${detailText}${duplicateText}`;
      }

      const empty = list.querySelector(':scope > .admin-member-filter-empty');
      if (empty) empty.hidden = visible !== 0;
    };

    regionSelect.addEventListener('change', applyFilters);
    statusSelect.addEventListener('change', applyFilters);
    duplicateSelect.addEventListener('change', applyFilters);
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