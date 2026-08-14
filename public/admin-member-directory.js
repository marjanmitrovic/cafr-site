(() => {
  'use strict';

  const DEFAULT_PAGE_SIZE = 25;
  const stateBySection = new WeakMap();

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('cs-CZ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function primaryMembersSection(shell) {
    return [...shell.querySelectorAll(':scope > .admin-panel-section')].find((section) => {
      if (section.id === 'adminMemberDirectory') return false;
      const heading = normalize(section.querySelector('h3')?.textContent);
      return /registrovani clenove|registered members/.test(heading);
    });
  }

  function memberCards(section) {
    return [...section.querySelectorAll(':scope > .admin-member-list > .admin-member-card')]
      .filter((card) => card.querySelector('[data-user-status], [data-user-role]'));
  }

  function matchingCards(section) {
    return memberCards(section).filter((card) => !card.classList.contains('admin-search-filtered-out'));
  }

  function render(section) {
    const state = stateBySection.get(section);
    if (!state) return;

    const cards = memberCards(section);
    const matches = matchingCards(section);
    const totalPages = Math.max(1, Math.ceil(matches.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    const pageSet = new Set(matches.slice(start, end));

    cards.forEach((card) => {
      const filteredOut = card.classList.contains('admin-search-filtered-out');
      card.hidden = filteredOut || !pageSet.has(card);
    });

    const from = matches.length ? start + 1 : 0;
    const to = Math.min(end, matches.length);
    state.info.textContent = matches.length
      ? `Zobrazeno ${from}–${to} z ${matches.length}`
      : 'Žádní členové';
    state.pageLabel.textContent = `Strana ${state.page} z ${totalPages}`;
    state.prev.disabled = state.page <= 1;
    state.next.disabled = state.page >= totalPages;

    const oldResult = section.querySelector('.admin-member-filter-result');
    if (oldResult) oldResult.textContent = matches.length ? `${matches.length} členů` : '0 členů';
  }

  function install(section) {
    if (!section || stateBySection.has(section)) return;
    const list = section.querySelector(':scope > .admin-member-list');
    if (!list) return;

    // Remove the separately injected directory if an older cached script created it.
    section.closest('.admin-shell')?.querySelector('#adminMemberDirectory')?.remove();

    const controls = document.createElement('div');
    controls.className = 'admin-member-pagination';
    controls.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:16px 0 4px;padding:12px 0;';
    controls.innerHTML = `
      <span data-member-page-info style="font-weight:600">Načítám…</span>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px">
          Na stránku
          <select data-member-page-size style="padding:8px 30px 8px 10px;border-radius:10px;border:1px solid #d7deea;background:#fff">
            <option value="25" selected>25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <button type="button" data-member-prev style="padding:8px 12px;border-radius:10px;border:1px solid #d7deea;background:#fff;font-weight:700">‹ Předchozí</button>
        <strong data-member-page-label style="min-width:100px;text-align:center">Strana 1 z 1</strong>
        <button type="button" data-member-next style="padding:8px 12px;border-radius:10px;border:1px solid #d7deea;background:#fff;font-weight:700">Další ›</button>
      </div>
    `;
    list.after(controls);

    const state = {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      info: controls.querySelector('[data-member-page-info]'),
      pageLabel: controls.querySelector('[data-member-page-label]'),
      prev: controls.querySelector('[data-member-prev]'),
      next: controls.querySelector('[data-member-next]'),
    };
    stateBySection.set(section, state);

    state.prev.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        render(section);
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    state.next.addEventListener('click', () => {
      state.page += 1;
      render(section);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    controls.querySelector('[data-member-page-size]').addEventListener('change', (event) => {
      state.pageSize = Number(event.target.value) || DEFAULT_PAGE_SIZE;
      state.page = 1;
      render(section);
    });

    const refresh = () => window.setTimeout(() => {
      state.page = 1;
      render(section);
    }, 0);

    section.querySelector('.admin-member-search-input')?.addEventListener('input', refresh);
    section.querySelector('.admin-member-search-input')?.addEventListener('search', refresh);
    section.querySelector('.admin-member-sort-select')?.addEventListener('change', refresh);

    const observer = new MutationObserver(() => render(section));
    observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    render(section);
  }

  function scan() {
    document.querySelectorAll('.admin-shell').forEach((shell) => {
      const section = primaryMembersSection(shell);
      if (section) install(section);
    });
  }

  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
