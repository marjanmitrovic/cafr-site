(() => {
  'use strict';

  const ACTIVE_TAB_KEY = 'ucfr-admin-active-tab';
  const ENHANCED_ATTR = 'adminTabsEnhanced';

  const tabs = [
    { id: 'members', cs: 'Členové', en: 'Members' },
    { id: 'incidents', cs: 'Incidenty', en: 'Incidents' },
    { id: 'legal', cs: 'Právní podpora', en: 'Legal support' },
    { id: 'seminars', cs: 'Semináře', en: 'Seminars' },
    { id: 'fees', cs: 'Příspěvky', en: 'Fees' },
    { id: 'documents', cs: 'Dokumenty', en: 'Documents' },
    { id: 'tests', cs: 'Testy', en: 'Tests' },
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

  function sectionText(section) {
    return normalize([
      section.id,
      section.querySelector('.section-label')?.textContent,
      section.querySelector('h3')?.textContent,
    ].filter(Boolean).join(' '));
  }

  function sectionTab(section) {
    if (section.id === 'adminMemberDirectory') return 'members';

    const text = sectionText(section);
    if (/clen|member|registrovan/.test(text)) return 'members';
    if (/incident/.test(text)) return 'incidents';
    if (/pravni|legal/.test(text)) return 'legal';
    if (/seminar/.test(text)) return 'seminars';
    if (/prispevk|fee/.test(text)) return 'fees';
    if (/document|knihovn/.test(text)) return 'documents';
    if (/test|otazk|question/.test(text)) return 'tests';
    return 'other';
  }

  function memberId(card) {
    return card.querySelector('[data-user-status]')?.dataset.userStatus ||
      card.querySelector('[data-user-role]')?.dataset.userRole || '';
  }

  function memberStatus(card) {
    return String(card.querySelector('[data-user-status]')?.value || '').toUpperCase();
  }

  function memberNumber(id) {
    return id ? `UCFR-${String(id).slice(-8).toUpperCase()}` : '';
  }

  function memberNameParts(card) {
    const fullName = String(card.querySelector('.admin-member-main h4, h4')?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    const parts = fullName.split(' ').filter(Boolean);
    return {
      fullName,
      firstName: parts.slice(0, -1).join(' ') || parts[0] || '',
      lastName: parts.length > 1 ? parts.at(-1) : parts[0] || '',
    };
  }

  function searchableMemberText(card) {
    const id = memberId(card);
    const name = memberNameParts(card).fullName;
    const email = card.querySelector('.admin-member-main h4 + p')?.textContent || '';
    const meta = [...card.querySelectorAll('.admin-member-meta span')]
      .map((item) => item.textContent || '')
      .join(' ');
    const membership = card.querySelector('[data-user-status]')?.value || '';
    const role = card.querySelector('[data-user-role]')?.value || '';

    return normalize([
      name,
      email,
      meta,
      membership,
      role,
      id,
      memberNumber(id),
    ].join(' '));
  }

  function memberSortValue(card, mode) {
    const name = memberNameParts(card);
    if (mode.startsWith('first')) return normalize(`${name.firstName} ${name.lastName}`);
    return normalize(`${name.lastName} ${name.firstName}`);
  }

  function primaryMembersSection(shell) {
    return [...shell.querySelectorAll(':scope > .admin-panel-section')].find((section) => {
      if (section.id === 'adminMemberDirectory') return false;
      const heading = normalize(section.querySelector('h3')?.textContent);
      return /registrovani clenove|registered members/.test(heading);
    });
  }

  function enhanceMemberList(shell) {
    const section = primaryMembersSection(shell);
    if (!section) return;

    const list = section.querySelector(':scope > .admin-member-list');
    if (!list) return;

    let toolbar = section.querySelector(':scope > .admin-member-filterbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'admin-member-filterbar';
      toolbar.innerHTML = `
        <label class="admin-member-search-field">
          <span>${isCzech() ? 'Vyhledat člena' : 'Search members'}</span>
          <input
            class="admin-member-search-input"
            type="search"
            autocomplete="off"
            placeholder="${isCzech()
              ? 'Jméno, příjmení, ID člena nebo ID FAČR…'
              : 'Name, member ID or FAČR ID…'}"
          >
        </label>
        <label class="admin-member-sort-field">
          <span>${isCzech() ? 'Řazení' : 'Sort'}</span>
          <select class="admin-member-sort-select">
            <option value="last-asc">${isCzech() ? 'Příjmení A–Z' : 'Surname A–Z'}</option>
            <option value="last-desc">${isCzech() ? 'Příjmení Z–A' : 'Surname Z–A'}</option>
            <option value="first-asc">${isCzech() ? 'Jméno A–Z' : 'First name A–Z'}</option>
            <option value="first-desc">${isCzech() ? 'Jméno Z–A' : 'First name Z–A'}</option>
          </select>
        </label>
        <div class="admin-member-filter-result" aria-live="polite"></div>
      `;
      list.before(toolbar);
    }

    const input = toolbar.querySelector('.admin-member-search-input');
    const sort = toolbar.querySelector('.admin-member-sort-select');
    const result = toolbar.querySelector('.admin-member-filter-result');

    const apply = () => {
      const query = normalize(input?.value);
      const mode = sort?.value || 'last-asc';
      const direction = mode.endsWith('desc') ? -1 : 1;
      const cards = [...list.querySelectorAll(':scope > .admin-member-card')]
        .filter((card) => card.querySelector('[data-user-status], [data-user-role]'));

      cards.sort((a, b) => {
        const aPending = memberStatus(a) === 'PENDING';
        const bPending = memberStatus(b) === 'PENDING';

        if (aPending !== bPending) return aPending ? -1 : 1;

        return direction * memberSortValue(a, mode).localeCompare(
          memberSortValue(b, mode),
          'cs',
          { sensitivity: 'base', numeric: true }
        );
      });
      cards.forEach((card) => list.appendChild(card));

      let visible = 0;
      cards.forEach((card) => {
        const show = !query || searchableMemberText(card).includes(query);
        card.hidden = !show;
        card.classList.toggle('admin-search-filtered-out', !show);
        if (show) visible += 1;
      });

      if (result) {
        result.textContent = isCzech()
          ? `Zobrazeno ${visible} z ${cards.length} členů · čekající vždy první`
          : `Showing ${visible} of ${cards.length} members · pending always first`;
      }

      let empty = list.querySelector(':scope > .admin-member-filter-empty');
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'admin-member-filter-empty';
        empty.textContent = isCzech()
          ? 'Žádný člen neodpovídá zadanému filtru.'
          : 'No member matches the filter.';
        list.appendChild(empty);
      }
      empty.hidden = visible !== 0;
    };

    if (toolbar.dataset.bound !== 'true') {
      toolbar.dataset.bound = 'true';
      input?.addEventListener('input', apply);
      input?.addEventListener('search', apply);
      sort?.addEventListener('change', apply);
      list.addEventListener('change', (event) => {
        if (event.target.matches('[data-user-status]')) {
          window.setTimeout(apply, 0);
        }
      });
    }

    apply();
  }

  function sectionCount(section) {
    const value = Number.parseInt(section.querySelector('.admin-count')?.textContent || '', 10);
    return Number.isFinite(value) ? value : 0;
  }

  function setActiveTab(shell, tabId, focus = false) {
    const available = new Set(
      [...shell.querySelectorAll(':scope > .admin-panel-section[data-admin-tab]')]
        .map((section) => section.dataset.adminTab)
    );
    const selected = available.has(tabId) ? tabId : available.has('members') ? 'members' : [...available][0];
    if (!selected) return;

    shell.querySelectorAll(':scope > .admin-panel-section[data-admin-tab]').forEach((section) => {
      section.hidden = section.dataset.adminTab !== selected;
    });

    shell.querySelectorAll('.admin-tab-button').forEach((button) => {
      const active = button.dataset.adminTabTarget === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });

    sessionStorage.setItem(ACTIVE_TAB_KEY, selected);
    if (focus) shell.querySelector(`[data-admin-tab-target="${selected}"]`)?.focus();
  }

  function buildTabs(shell) {
    const sections = [...shell.querySelectorAll(':scope > .admin-panel-section')];
    if (!sections.length) return;

    sections.forEach((section) => {
      section.dataset.adminTab = sectionTab(section);
    });

    let nav = shell.querySelector(':scope > .admin-tab-navigation');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'admin-tab-navigation';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', isCzech() ? 'Sekce administrace' : 'Administration sections');
      const stats = shell.querySelector(':scope > .admin-stats');
      if (stats) stats.after(nav);
      else shell.querySelector(':scope > .admin-head')?.after(nav);
    }

    const availableTabs = tabs.filter((tab) => sections.some((section) => section.dataset.adminTab === tab.id));
    nav.innerHTML = availableTabs.map((tab) => {
      const count = sections
        .filter((section) => section.dataset.adminTab === tab.id)
        .reduce((sum, section) => sum + sectionCount(section), 0);
      return `
        <button
          class="admin-tab-button"
          type="button"
          role="tab"
          aria-selected="false"
          data-admin-tab-target="${tab.id}"
        >
          <span>${isCzech() ? tab.cs : tab.en}</span>
          <b>${count}</b>
        </button>
      `;
    }).join('');

    nav.querySelectorAll('.admin-tab-button').forEach((button) => {
      button.addEventListener('click', () => {
        setActiveTab(shell, button.dataset.adminTabTarget, true);
        nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...nav.querySelectorAll('.admin-tab-button')];
        const current = buttons.indexOf(button);
        let next = current;
        if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
        if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        buttons[next]?.click();
      });
    });

    setActiveTab(shell, sessionStorage.getItem(ACTIVE_TAB_KEY) || 'members');
  }

  function enhance(shell) {
    if (!shell) return;
    buildTabs(shell);
    enhanceMemberList(shell);
    shell.dataset[ENHANCED_ATTR] = 'true';
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