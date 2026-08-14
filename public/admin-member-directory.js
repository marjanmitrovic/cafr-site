(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : window.location.origin);

  const DEFAULT_PAGE_SIZE = 50;
  const stateBySection = new WeakMap();

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

  function adminToken() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function primaryMembersSection(shell) {
    return [...shell.querySelectorAll(':scope > .admin-panel-section')].find((section) => {
      if (section.id === 'adminMemberDirectory') return false;
      const heading = normalize(section.querySelector('h3')?.textContent);
      return /registrovani clenove|registered members/.test(heading);
    });
  }

  function renderCards(users) {
    if (!users.length) {
      return `<div class="empty-results"><h3>${isCzech() ? 'Žádní uživatelé' : 'No users'}</h3></div>`;
    }

    return users.map((user) => `
      <article class="admin-member-card">
        <div class="admin-member-main">
          <div class="admin-member-avatar">
            ${escapeHtml((user.firstName || '?').charAt(0).toUpperCase())}${escapeHtml((user.lastName || '?').charAt(0).toUpperCase())}
          </div>
          <div>
            <h4>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</h4>
            <p>${escapeHtml(user.email)}</p>
            <div class="admin-member-meta">
              <span>${escapeHtml(user.region || '—')}</span>
              <span>${escapeHtml(user.refereeStatus || '—')}</span>
              <span>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('cs-CZ') : '—'}</span>
            </div>
          </div>
        </div>
        <div class="admin-member-controls">
          <label>
            ${isCzech() ? 'Členství' : 'Membership'}
            <select data-user-status="${escapeHtml(user.id)}">
              ${['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].map((status) => `
                <option value="${status}" ${user.membershipStatus === status ? 'selected' : ''}>${status}</option>
              `).join('')}
            </select>
          </label>
          <label>
            Role
            <select data-user-role="${escapeHtml(user.id)}">
              ${['MEMBER', 'LECTURER', 'QUESTION_EDITOR', 'ADMIN', 'BOARD'].map((role) => `
                <option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>
              `).join('')}
            </select>
          </label>
        </div>
      </article>
    `).join('');
  }

  async function fetchPage(state) {
    const token = adminToken();
    if (!token) throw new Error(isCzech() ? 'Chybí administrátorský token.' : 'Administrator token is missing.');

    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.pageSize),
    });
    if (state.query) params.set('q', state.query);
    if (state.region && state.region !== 'ALL') params.set('region', state.region);
    if (state.status && state.status !== 'ALL') params.set('status', state.status);

    const response = await fetch(`${API_BASE}/api/admin/users-page?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || (isCzech() ? 'Členy nelze načíst.' : 'Could not load members.'));
    return data;
  }

  function updateControls(state) {
    const from = state.total ? ((state.page - 1) * state.pageSize) + 1 : 0;
    const to = Math.min(state.page * state.pageSize, state.total);
    state.info.textContent = state.total
      ? `${isCzech() ? 'Zobrazeno' : 'Showing'} ${from}–${to} ${isCzech() ? 'z' : 'of'} ${state.total}`
      : (isCzech() ? 'Žádní členové' : 'No members');
    state.pageLabel.textContent = isCzech()
      ? `Strana ${state.page} z ${state.totalPages}`
      : `Page ${state.page} of ${state.totalPages}`;
    state.prev.disabled = state.loading || state.page <= 1;
    state.next.disabled = state.loading || state.page >= state.totalPages;
    if (state.count) state.count.textContent = String(state.total);
  }

  async function loadPage(section, state, scroll = false) {
    const requestId = ++state.requestId;
    state.loading = true;
    updateControls(state);
    state.list.innerHTML = `<div class="loading-state">${isCzech() ? 'Načítám členy…' : 'Loading members…'}</div>`;

    try {
      const data = await fetchPage(state);
      if (requestId !== state.requestId) return;
      state.page = Number(data.page || 1);
      state.pageSize = Number(data.limit || state.pageSize);
      state.total = Number(data.total || 0);
      state.totalPages = Number(data.totalPages || 1);
      state.list.innerHTML = renderCards(Array.isArray(data.users) ? data.users : []);
      updateControls(state);
      if (scroll) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.list.innerHTML = `<div class="empty-results"><h3>${escapeHtml(error.message)}</h3></div>`;
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        updateControls(state);
      }
    }
  }

  function bindFilters(section, state) {
    const search = section.querySelector('.admin-member-search-input');
    const region = section.querySelector('.admin-member-region-select');
    const status = section.querySelector('.admin-member-status-select');

    if (search && search.dataset.serverPagerBound !== 'true') {
      search.dataset.serverPagerBound = 'true';
      let timer = null;
      const apply = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          state.query = String(search.value || '').trim();
          state.page = 1;
          loadPage(section, state);
        }, 300);
      };
      search.addEventListener('input', apply);
      search.addEventListener('search', apply);
    }

    if (region && region.dataset.serverPagerBound !== 'true') {
      region.dataset.serverPagerBound = 'true';
      region.addEventListener('change', () => {
        state.region = region.value;
        state.page = 1;
        loadPage(section, state);
      });
    }

    if (status && status.dataset.serverPagerBound !== 'true') {
      status.dataset.serverPagerBound = 'true';
      status.addEventListener('change', () => {
        state.status = status.value;
        state.page = 1;
        loadPage(section, state);
      });
    }
  }

  function install(section) {
    if (!section || stateBySection.has(section)) return;
    const list = section.querySelector(':scope > .admin-member-list');
    if (!list) return;

    section.closest('.admin-shell')?.querySelector('#adminMemberDirectory')?.remove();

    const controls = document.createElement('div');
    controls.className = 'admin-member-pagination';
    controls.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:14px 0;padding:12px 0;';
    controls.innerHTML = `
      <span data-member-page-info style="font-weight:700">${isCzech() ? 'Načítám…' : 'Loading…'}</span>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px">
          ${isCzech() ? 'Na stránku' : 'Per page'}
          <select data-member-page-size style="padding:8px 30px 8px 10px;border-radius:10px;border:1px solid #d7deea;background:#fff">
            <option value="25">25</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
          </select>
        </label>
        <button type="button" data-member-prev style="padding:8px 12px;border-radius:10px;border:1px solid #d7deea;background:#fff;font-weight:700">‹ ${isCzech() ? 'Předchozí' : 'Previous'}</button>
        <strong data-member-page-label style="min-width:105px;text-align:center">${isCzech() ? 'Strana 1 z 1' : 'Page 1 of 1'}</strong>
        <button type="button" data-member-next style="padding:8px 12px;border-radius:10px;border:1px solid #d7deea;background:#fff;font-weight:700">${isCzech() ? 'Další' : 'Next'} ›</button>
      </div>
    `;

    // Controls are deliberately ABOVE the cards so they are visible immediately,
    // even when the database contains hundreds of members.
    list.before(controls);

    const state = {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 0,
      totalPages: 1,
      query: '',
      region: 'ALL',
      status: 'ALL',
      loading: false,
      requestId: 0,
      list,
      count: section.querySelector('.admin-count'),
      info: controls.querySelector('[data-member-page-info]'),
      pageLabel: controls.querySelector('[data-member-page-label]'),
      prev: controls.querySelector('[data-member-prev]'),
      next: controls.querySelector('[data-member-next]'),
    };
    stateBySection.set(section, state);

    state.prev.addEventListener('click', () => {
      if (state.loading || state.page <= 1) return;
      state.page -= 1;
      loadPage(section, state, true);
    });
    state.next.addEventListener('click', () => {
      if (state.loading || state.page >= state.totalPages) return;
      state.page += 1;
      loadPage(section, state, true);
    });
    controls.querySelector('[data-member-page-size]').addEventListener('change', (event) => {
      state.pageSize = Number(event.target.value) || DEFAULT_PAGE_SIZE;
      state.page = 1;
      loadPage(section, state);
    });

    section.addEventListener('change', async (event) => {
      const select = event.target;
      if (!select.matches('[data-user-status], [data-user-role]')) return;
      // Initial cards still have handlers attached by main.js. After the first
      // server page render, new cards use this delegated handler instead.
      if (typeof select.onchange === 'function') return;

      const isStatus = select.matches('[data-user-status]');
      const id = isStatus ? select.dataset.userStatus : select.dataset.userRole;
      select.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(id)}/${isStatus ? 'status' : 'role'}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken()}`,
          },
          body: JSON.stringify(isStatus ? { membershipStatus: select.value } : { role: select.value }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Update failed');
        await loadPage(section, state);
      } catch (error) {
        alert(error.message);
        select.disabled = false;
      }
    });

    const filterObserver = new MutationObserver(() => bindFilters(section, state));
    filterObserver.observe(section, { childList: true, subtree: true });
    bindFilters(section, state);
    loadPage(section, state);
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
