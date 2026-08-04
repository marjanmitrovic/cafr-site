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

  function tabFor(section) {
    if (section.id === 'adminMemberDirectory') return 'members';
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
    if (/document|knihovn/.test(text)) return 'documents';
    if (/test|otazk|question/.test(text)) return 'tests';
    return 'other';
  }

  function syncMemberCount(shell) {
    const primaryMembersSection = [...shell.querySelectorAll(':scope > .admin-panel-section')]
      .find((section) => section.id !== 'adminMemberDirectory' && tabFor(section) === 'members');
    const count = primaryMembersSection?.querySelector('.admin-count')?.textContent?.trim();
    const badge = shell.querySelector('[data-admin-tab-target="members"] b');
    if (badge && count) badge.textContent = count;
  }

  function sync(shell) {
    if (!shell) return;
    const active = sessionStorage.getItem(ACTIVE_TAB_KEY) || 'members';
    shell.querySelectorAll(':scope > .admin-panel-section').forEach((section) => {
      if (!section.dataset.adminTab) section.dataset.adminTab = tabFor(section);
      section.hidden = section.dataset.adminTab !== active;
    });
    syncMemberCount(shell);
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.admin-tab-button')) return;
    window.setTimeout(() => sync(event.target.closest('.admin-shell')), 0);
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('.admin-shell')) sync(node);
        if (node.matches?.('.admin-panel-section') && node.parentElement?.matches('.admin-shell')) {
          sync(node.parentElement);
        }
        node.querySelectorAll?.('.admin-shell').forEach(sync);
      });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
