(() => {
  'use strict';

  const ACTIVE_TAB_KEY = 'ucfr-admin-active-tab';

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

  function setText(element, value) {
    if (!element) return;
    const next = String(value);
    if (element.textContent !== next) element.textContent = next;
  }

  function tabFor(section) {
    if (section.id === 'adminMemberDirectory') return 'members';
    if (section.id === 'adminNewsCms') return 'news';
    if (section.id === 'adminLocalUnits') return 'units';

    const text = normalize([
      section.id,
      section.querySelector('.section-label')?.textContent,
      section.querySelector('h3')?.textContent,
    ].filter(Boolean).join(' '));

    if (/clen|member|registrovan/.test(text)) return 'members';
    if (/incident/.test(text)) return 'incidents';
    if (/pravni|legal/.test(text)) return 'legal';
    if (/seminar/.test(text)) return 'seminars';
    if (/prispevk|fee/.test(text)) return 'fees';
    if (/aktualit|news|clank/.test(text)) return 'news';
    if (/lokalni jednotk|organizacni jednotk|local unit/.test(text)) return 'units';
    if (/document|knihovn/.test(text)) return 'documents';
    if (/test|otazk|question/.test(text)) return 'tests';
    return 'other';
  }

  function sectionCount(section) {
    const value = Number.parseInt(section.querySelector('.admin-count')?.textContent || '', 10);
    return Number.isFinite(value) ? value : 0;
  }

  function syncMemberCount(shell) {
    const primaryMembersSection = [...shell.querySelectorAll(':scope > .admin-panel-section')]
      .find((section) => section.id !== 'adminMemberDirectory' && tabFor(section) === 'members');
    const count = primaryMembersSection?.querySelector('.admin-count')?.textContent?.trim();
    if (count) setText(shell.querySelector('[data-admin-tab-target="members"] b'), count);
  }

  function documentCategory(card) {
    return normalize(card.querySelector('.admin-member-meta span:first-child')?.textContent || '');
  }

  function isNewsDocumentCard(card) {
    if (card.matches('[data-news-card]')) return true;
    return documentCategory(card) === 'news';
  }

  function isLocalUnitDocumentCard(card) {
    return documentCategory(card) === 'local_unit';
  }

  function separateStructuredRecordsFromDocuments(shell) {
    const newsSection = shell.querySelector(':scope > #adminNewsCms');
    if (newsSection) {
      newsSection.dataset.adminTab = 'news';
      setText(newsSection.querySelector('.section-label'), isCzech() ? 'AKTUALITY' : 'NEWS');
    }

    const unitsSection = shell.querySelector(':scope > #adminLocalUnits');
    if (unitsSection) unitsSection.dataset.adminTab = 'units';

    const documentSections = [...shell.querySelectorAll(':scope > .admin-panel-section')]
      .filter((section) => section !== newsSection && section !== unitsSection && section.dataset.adminTab === 'documents');

    documentSections.forEach((section) => {
      const list = section.querySelector(':scope > .admin-member-list');
      if (!list) return;

      list.querySelectorAll(':scope > .admin-member-card').forEach((card) => {
        if (isNewsDocumentCard(card) || isLocalUnitDocumentCard(card)) card.remove();
      });

      const total = list.querySelectorAll(':scope > .admin-member-card').length;
      setText(section.querySelector('.admin-count'), total);
    });
  }

  function activateTab(shell, tabId, focus = false) {
    shell.querySelectorAll(':scope > .admin-panel-section[data-admin-tab]').forEach((section) => {
      section.hidden = section.dataset.adminTab !== tabId;
    });

    shell.querySelectorAll('.admin-tab-button').forEach((button) => {
      const active = button.dataset.adminTabTarget === tabId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });

    sessionStorage.setItem(ACTIVE_TAB_KEY, tabId);
    if (focus) shell.querySelector(`[data-admin-tab-target="${tabId}"]`)?.focus();
  }

  function ensureNewsTab(shell) {
    const nav = shell.querySelector(':scope > .admin-tab-navigation');
    const newsSections = [...shell.querySelectorAll(':scope > .admin-panel-section[data-admin-tab="news"]')];
    if (!nav || !newsSections.length) return;

    let button = nav.querySelector('[data-admin-tab-target="news"]');
    if (!button) {
      button = document.createElement('button');
      button.className = 'admin-tab-button';
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', 'false');
      button.dataset.adminTabTarget = 'news';
      button.innerHTML = `<span>${isCzech() ? 'Aktuality' : 'News'}</span><b>0</b>`;

      const documentsButton = nav.querySelector('[data-admin-tab-target="documents"]');
      if (documentsButton) nav.insertBefore(button, documentsButton);
      else nav.appendChild(button);

      button.addEventListener('click', () => {
        activateTab(shell, 'news', true);
        nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    setText(button.querySelector('span'), isCzech() ? 'Aktuality' : 'News');
    const count = newsSections.reduce((sum, section) => sum + sectionCount(section), 0);
    setText(button.querySelector('b'), count);
  }

  function ensureUnitsTab(shell) {
    const nav = shell.querySelector(':scope > .admin-tab-navigation');
    const unitSections = [...shell.querySelectorAll(':scope > .admin-panel-section[data-admin-tab="units"]')];
    if (!nav || !unitSections.length) return;

    let button = nav.querySelector('[data-admin-tab-target="units"]');
    if (!button) {
      button = document.createElement('button');
      button.className = 'admin-tab-button';
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', 'false');
      button.dataset.adminTabTarget = 'units';
      button.innerHTML = `<span>${isCzech() ? 'Organizační jednotky' : 'Local units'}</span><b>0</b>`;

      const documentsButton = nav.querySelector('[data-admin-tab-target="documents"]');
      if (documentsButton) nav.insertBefore(button, documentsButton);
      else nav.appendChild(button);

      button.addEventListener('click', () => {
        activateTab(shell, 'units', true);
        nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    setText(button.querySelector('span'), isCzech() ? 'Organizační jednotky' : 'Local units');
    const count = unitSections.reduce((sum, section) => sum + sectionCount(section), 0);
    setText(button.querySelector('b'), count);
  }

  function syncDocumentCount(shell) {
    const total = [...shell.querySelectorAll(':scope > .admin-panel-section[data-admin-tab="documents"]')]
      .reduce((sum, section) => sum + sectionCount(section), 0);
    setText(shell.querySelector('[data-admin-tab-target="documents"] b'), total);
  }

  function sync(shell) {
    if (!shell) return;

    const sections = [...shell.querySelectorAll(':scope > .admin-panel-section')];
    sections.forEach((section) => {
      section.dataset.adminTab = tabFor(section);
    });

    separateStructuredRecordsFromDocuments(shell);
    ensureNewsTab(shell);
    ensureUnitsTab(shell);
    syncMemberCount(shell);
    syncDocumentCount(shell);

    const active = sessionStorage.getItem(ACTIVE_TAB_KEY) || 'members';
    const available = new Set(sections.map((section) => section.dataset.adminTab));
    const selected = available.has(active) ? active : available.has('members') ? 'members' : sections[0]?.dataset.adminTab;

    shell.querySelectorAll(':scope > .admin-panel-section').forEach((section) => {
      section.hidden = section.dataset.adminTab !== selected;
    });

    shell.querySelectorAll('.admin-tab-button').forEach((button) => {
      const isActive = button.dataset.adminTabTarget === selected;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.admin-tab-button')) return;
    window.setTimeout(() => sync(event.target.closest('.admin-shell')), 0);
  });

  let frame = null;
  const pendingShells = new Set();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const targetShell = mutation.target?.nodeType === Node.ELEMENT_NODE
        ? mutation.target.closest?.('.admin-shell')
        : mutation.target?.parentElement?.closest?.('.admin-shell');
      if (targetShell) pendingShells.add(targetShell);

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const shell = node.matches?.('.admin-shell') ? node : node.closest?.('.admin-shell');
        if (shell) pendingShells.add(shell);
        node.querySelectorAll?.('.admin-shell').forEach((item) => pendingShells.add(item));
      });
    }

    if (frame !== null || !pendingShells.size) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const shells = [...pendingShells];
      pendingShells.clear();
      shells.forEach(sync);
    });
  });

  document.querySelectorAll('.admin-shell').forEach(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
