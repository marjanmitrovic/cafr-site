(() => {
  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : window.location.origin
    );

  const DIRECTORY_ID = 'adminMemberDirectory';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('cafr-user') || 'null');
    } catch {
      return null;
    }
  }

  function adminToken() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function memberNumber(user) {
    return `UCFR-${String(user.id || '').slice(-8).toUpperCase()}`;
  }

  function normalize(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function toCsvValue(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function exportCsv(users) {
    const header = ['Číslo člena', 'Jméno', 'Příjmení', 'Email', 'Telefon', 'Region', 'Status rozhodčího', 'Členství', 'Role', 'Registrován'];
    const rows = users.map((user) => [
      memberNumber(user),
      user.firstName,
      user.lastName,
      user.email,
      user.phone || '',
      user.region || '',
      user.refereeStatus || '',
      user.membershipStatus || '',
      user.role || '',
      user.createdAt ? new Date(user.createdAt).toLocaleDateString('cs-CZ') : '',
    ]);

    const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cafr-clensky-imenik-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderRows(users) {
    return users.map((user) => `
      <tr>
        <td><strong>${escapeHtml(memberNumber(user))}</strong></td>
        <td>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.phone || '—')}</td>
        <td>${escapeHtml(user.region || '—')}</td>
        <td>${escapeHtml(user.refereeStatus || '—')}</td>
        <td><span class="admin-directory-status ${escapeHtml(user.membershipStatus || '')}">${escapeHtml(user.membershipStatus || '—')}</span></td>
        <td>${escapeHtml(user.role || '—')}</td>
        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('cs-CZ') : '—'}</td>
      </tr>
    `).join('');
  }

  function applyFilter(section, users) {
    const input = section.querySelector('#adminDirectorySearch');
    const tbody = section.querySelector('#adminDirectoryRows');
    const count = section.querySelector('#adminDirectoryCount');
    const query = normalize(input?.value || '');

    const filtered = query
      ? users.filter((user) => normalize([
        memberNumber(user),
        user.firstName,
        user.lastName,
        user.email,
        user.phone,
        user.region,
        user.refereeStatus,
        user.membershipStatus,
        user.role,
      ].join(' ')).includes(query))
      : users;

    tbody.innerHTML = filtered.length
      ? renderRows(filtered)
      : '<tr><td colspan="9">Žádný člen neodpovídá filtru.</td></tr>';
    count.textContent = String(filtered.length);

    const exportButton = section.querySelector('#adminDirectoryExport');
    exportButton.onclick = () => exportCsv(filtered);
  }

  async function fetchUsers() {
    const token = adminToken();
    if (!token) throw new Error('Admin token missing');

    const response = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Members could not be loaded');
    return Array.isArray(data) ? data : [];
  }

  async function injectDirectory() {
    if (document.getElementById(DIRECTORY_ID)) return true;

    const shell = document.querySelector('.admin-shell');
    if (!shell) return false;

    const currentUser = getStoredUser();
    if (currentUser?.role !== 'ADMIN') return true;

    const section = document.createElement('section');
    section.id = DIRECTORY_ID;
    section.className = 'admin-panel-section admin-directory-section';
    section.innerHTML = `
      <div class="admin-section-head">
        <div>
          <span class="section-label">ADMIN ONLY</span>
          <h3>Členský imenik</h3>
          <p class="admin-directory-note">Dostupné pouze administrátorům. Obsahuje všechny registrované členy.</p>
        </div>
        <span class="admin-count" id="adminDirectoryCount">0</span>
      </div>

      <div class="admin-directory-toolbar">
        <input id="adminDirectorySearch" class="admin-directory-search" type="search" placeholder="Hledat podle jména, e-mailu, telefonu, regionu, role…">
        <button id="adminDirectoryExport" class="admin-directory-export" type="button">Export CSV</button>
      </div>

      <div class="admin-directory-table-wrap">
        <table class="admin-directory-table">
          <thead>
            <tr>
              <th>Číslo</th>
              <th>Jméno</th>
              <th>Email</th>
              <th>Telefon</th>
              <th>Region</th>
              <th>Status rozhodčího</th>
              <th>Členství</th>
              <th>Role</th>
              <th>Registrace</th>
            </tr>
          </thead>
          <tbody id="adminDirectoryRows">
            <tr><td colspan="9">Načítám členy…</td></tr>
          </tbody>
        </table>
      </div>
    `;

    const firstMembersSection = shell.querySelector('.admin-panel-section');
    if (firstMembersSection?.after) firstMembersSection.after(section);
    else shell.appendChild(section);

    try {
      const users = await fetchUsers();
      users.sort((a, b) => `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`, 'cs'));
      section.querySelector('#adminDirectorySearch').addEventListener('input', () => applyFilter(section, users));
      applyFilter(section, users);
    } catch (error) {
      section.querySelector('#adminDirectoryRows').innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`;
    }

    return true;
  }

  if (!injectDirectory()) {
    const observer = new MutationObserver(() => {
      if (injectDirectory()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 20000);
  }
})();
