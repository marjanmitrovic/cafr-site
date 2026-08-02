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

  function adminToken() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function memberNumber(user) {
    return `UCFR-${String(user.id || '').slice(-8).toUpperCase()}`;
  }

  function normalize(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function parseRefereeStatus(value) {
    const raw = String(value || '').trim();
    const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);

    const facrPart = parts.find((part) => /^(?:ID\s*)?FAČR\s*:/i.test(part));
    const listPart = parts.find((part) => /^(?:Listina|Soutěž|Referee list)\s*:/i.test(part));
    const roleParts = parts.filter((part) => part !== facrPart && part !== listPart);

    return {
      role: roleParts.join(' | ') || (!facrPart && !listPart ? raw : ''),
      facrId: facrPart ? facrPart.replace(/^(?:ID\s*)?FAČR\s*:\s*/i, '') : '',
      refereeList: listPart ? listPart.replace(/^(?:Listina|Soutěž|Referee list)\s*:\s*/i, '') : '',
    };
  }

  function membershipLabel(value) {
    return ({
      PENDING: 'Čeká na schválení',
      APPROVED: 'Schválené členství',
      REJECTED: 'Zamítnutá přihláška',
      SUSPENDED: 'Pozastavené členství',
    })[value] || String(value || '');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('cs-CZ');
  }

  function protectSpreadsheetFormula(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  }

  function toCsvValue(value) {
    return `"${protectSpreadsheetFormula(value).replace(/"/g, '""')}"`;
  }

  function exportCsv(users) {
    const header = [
      'Členské číslo',
      'Interní ID',
      'Jméno',
      'Příjmení',
      'E-mail',
      'Telefon',
      'Kraj / okres',
      'Status / funkce rozhodčího',
      'ID FAČR',
      'Listina rozhodčích',
      'Stav členství',
      'Systémová role',
      'Aktivní účet',
      'Jazyk',
      'Datum registrace',
      'Datum schválení',
    ];

    const rows = users.map((user) => {
      const referee = parseRefereeStatus(user.refereeStatus);

      return [
        memberNumber(user),
        user.id,
        user.firstName,
        user.lastName,
        user.email,
        user.phone || '',
        user.region || '',
        referee.role,
        referee.facrId,
        referee.refereeList,
        membershipLabel(user.membershipStatus),
        user.role || '',
        user.isActive ? 'Ano' : 'Ne',
        user.language || '',
        formatDate(user.createdAt),
        formatDate(user.approvedAt),
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map(toCsvValue).join(';'))
      .join('\r\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ucfr-databaze-clenstvi-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  }

  async function fetchUsers() {
    const token = adminToken();
    if (!token) throw new Error('Chybí administrátorský token. Přihlaste se znovu.');

    const response = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Databázi členů nelze načíst.');
    return Array.isArray(data) ? data : [];
  }

  async function injectDirectory() {
    if (document.getElementById(DIRECTORY_ID)) return true;

    const shell = document.querySelector('.admin-shell');
    if (!shell) return false;

    const section = document.createElement('section');
    section.id = DIRECTORY_ID;
    section.className = 'admin-panel-section admin-directory-section';
    section.innerHTML = `
      <div class="admin-section-head">
        <div>
          <span class="section-label">DATABÁZE ČLENSTVÍ</span>
          <h3>Členský adresář</h3>
          <p class="admin-directory-note">Úplný přehled všech registrovaných osob a členských údajů.</p>
        </div>
        <span class="admin-count" id="adminDirectoryCount">0</span>
      </div>

      <div class="admin-directory-toolbar">
        <input id="adminDirectorySearch" class="admin-directory-search" type="search" placeholder="Hledat podle jména, e-mailu, telefonu, regionu, ID FAČR…">
        <button id="adminDirectoryExport" class="admin-directory-export" type="button">
          Export databáze členství (.CSV)
        </button>
      </div>

      <div class="admin-directory-table-wrap">
        <table class="admin-directory-table">
          <thead>
            <tr>
              <th>Číslo</th>
              <th>Jméno</th>
              <th>E-mail</th>
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

      const exportButton = section.querySelector('#adminDirectoryExport');
      exportButton.addEventListener('click', () => {
        const originalText = exportButton.textContent;
        exportButton.disabled = true;
        exportButton.textContent = 'Připravuji CSV…';

        try {
          exportCsv(users);
          exportButton.textContent = `Exportováno: ${users.length} záznamů`;
        } catch (error) {
          console.error('Membership CSV export error:', error);
          exportButton.textContent = 'Export se nezdařil';
        }

        window.setTimeout(() => {
          exportButton.disabled = false;
          exportButton.textContent = originalText;
        }, 1800);
      });

      applyFilter(section, users);
    } catch (error) {
      section.querySelector('#adminDirectoryRows').innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`;
      const exportButton = section.querySelector('#adminDirectoryExport');
      exportButton.disabled = true;
      exportButton.title = error.message;
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
