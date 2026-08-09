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

  function isNewsDocumentCard(card) {
    if (card.matches('[data-news-card]')) return true;
    const category = card.querySelector('.admin-member-meta span:first-child')?.textContent || '';
    return normalize(category) === 'news';
  }

  function separateNewsFromDocuments(shell) {
    const newsSection = shell.querySelector(':scope > #adminNewsCms');
    if (newsSection) {
      newsSection.dataset.adminTab = 'news';
      setText(newsSection.querySelector('.section-label'), isCzech() ? 'AKTUALITY' : 'NEWS');
    }

    const documentSections = [...shell.querySelectorAll(':scope > .admin-panel-section')]
      .filter((section) => section !== newsSection && section.dataset.adminTab === 'documents');

    documentSections.forEach((section) => {
      const list = section.querySelector(':scope > .admin-member-list');
      if (!list) return;

      list.querySelectorAll(':scope > .admin-member-card').forEach((card) => {
        if (isNewsDocumentCard(card)) card.remove();
      });

      const total = list.querySelectorAll(':scope > .admin-member-card').length;
      setText(section.querySelector('.admin-count'), total);
    });
  }

  function activateNewsTab(shell, focus = false) {
    shell.querySelectorAll(':scope > .admin-panel-section[data-admin-tab]').forEach((section) => {
      section.hidden = section.dataset.adminTab !== 'news';
    });

    shell.querySelectorAll('.admin-tab-button').forEach((button) => {
      const active = button.dataset.adminTabTarget === 'news';
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });

    sessionStorage.setItem(ACTIVE_TAB_KEY, 'news');
    if (focus) shell.querySelector('[data-admin-tab-target="news"]')?.focus();
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
        activateNewsTab(shell, true);
        nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    setText(button.querySelector('span'), isCzech() ? 'Aktuality' : 'News');
    const count = newsSections.reduce((sum, section) => sum + sectionCount(section), 0);
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

    separateNewsFromDocuments(shell);
    ensureNewsTab(shell);
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
