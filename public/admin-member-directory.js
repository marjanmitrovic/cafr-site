(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : window.location.origin
    );

  const DIRECTORY_ID = 'adminMemberDirectory';

  const REGION_OPTIONS = [
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

  const REFEREE_ROLES = [
    'Aktivní rozhodčí',
    'Asistent rozhodčího',
    'Bývalý rozhodčí',
    'Delegát',
    'Pozorovatel rozhodčích',
  ];

  const REFEREE_LISTS = [
    'Profesionální soutěže',
    'Divize / ČFL / MSFL',
    'Krajské soutěže',
    'Okresní soutěže',
    'Bývalý rozhodčí / Ostatní',
  ];

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

  function optionList(values, placeholder) {
    return [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
    ].join('');
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
        <td><span class="admin-directory-status ${escapeHtml(user.membershipStatus || '')}">${escapeHtml(membershipLabel(user.membershipStatus) || '—')}</span></td>
        <td>${escapeHtml(user.role || '—')}</td>
        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('cs-CZ') : '—'}</td>
        <td>
          ${user.membershipStatus === 'PENDING'
            ? `<button class="admin-directory-edit" type="button" data-edit-member="${escapeHtml(user.id)}">Upravit před schválením</button>`
            : '<span class="admin-directory-locked">—</span>'}
        </td>
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
      : '<tr><td colspan="10">Žádný člen neodpovídá filtru.</td></tr>';
    count.textContent = String(filtered.length);
  }

  function closeEditor(section) {
    const editor = section.querySelector('#adminMemberEditor');
    if (!editor) return;
    editor.hidden = true;
    editor.querySelector('form')?.reset();
    const message = editor.querySelector('#adminMemberEditorMessage');
    if (message) {
      message.textContent = '';
      message.className = 'admin-member-editor-message';
    }
  }

  function setSelectValue(select, value) {
    if (!select) return;
    const normalizedValue = String(value || '').trim();
    if (normalizedValue && ![...select.options].some((option) => option.value === normalizedValue)) {
      select.add(new Option(normalizedValue, normalizedValue));
    }
    select.value = normalizedValue;
  }

  function openEditor(section, user) {
    if (!user || user.membershipStatus !== 'PENDING') return;

    const editor = section.querySelector('#adminMemberEditor');
    const form = editor?.querySelector('#adminMemberEditorForm');
    if (!editor || !form) return;

    const referee = parseRefereeStatus(user.refereeStatus);
    form.elements.memberId.value = user.id;
    form.elements.firstName.value = user.firstName || '';
    form.elements.lastName.value = user.lastName || '';
    form.elements.email.value = user.email || '';
    form.elements.phone.value = user.phone || '';
    setSelectValue(form.elements.region, user.region || '');
    setSelectValue(form.elements.refereeRole, referee.role || '');
    form.elements.facrId.value = referee.facrId || '';
    setSelectValue(form.elements.refereeList, referee.refereeList || '');

    editor.querySelector('#adminMemberEditorTitle').textContent =
      `Upravit přihlášku: ${user.firstName || ''} ${user.lastName || ''}`.trim();
    editor.hidden = false;
    form.elements.firstName.focus();
  }

  async function saveMember(section, users, form) {
    const message = section.querySelector('#adminMemberEditorMessage');
    const submitButton = form.querySelector('button[type="submit"]');

    if (!form.checkValidity()) {
      message.textContent = 'Vyplňte prosím všechna povinná pole.';
      message.className = 'admin-member-editor-message error';
      form.reportValidity();
      return;
    }

    const facrId = String(form.elements.facrId.value || '').trim();
    if (!/^\d+$/.test(facrId)) {
      form.elements.facrId.setCustomValidity('ID FAČR může obsahovat pouze číslice.');
      message.textContent = 'ID FAČR je povinné a může obsahovat pouze číslice.';
      message.className = 'admin-member-editor-message error';
      form.elements.facrId.reportValidity();
      form.elements.facrId.focus();
      return;
    }

    form.elements.facrId.setCustomValidity('');
    const payload = {
      firstName: String(form.elements.firstName.value || '').trim(),
      lastName: String(form.elements.lastName.value || '').trim(),
      email: String(form.elements.email.value || '').trim(),
      phone: String(form.elements.phone.value || '').trim(),
      region: String(form.elements.region.value || '').trim(),
      refereeStatus: [
        String(form.elements.refereeRole.value || '').trim(),
        `ID FAČR: ${facrId}`,
        `Listina: ${String(form.elements.refereeList.value || '').trim()}`,
      ].join(' | '),
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Ukládám…';
    message.textContent = '';

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(form.elements.memberId.value)}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken()}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Údaje přihlášky se nepodařilo uložit.');

      const index = users.findIndex((user) => user.id === data.user?.id);
      if (index >= 0) users[index] = { ...users[index], ...data.user };
      users.sort((a, b) => `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`, 'cs'));
      applyFilter(section, users);

      message.textContent = 'Údaje byly uloženy. Přihlášku nyní můžete schválit.';
      message.className = 'admin-member-editor-message success';
      window.setTimeout(() => closeEditor(section), 900);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'admin-member-editor-message error';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Uložit změny';
    }
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
          <p class="admin-directory-note">Úplný přehled všech registrovaných osob. Žádosti ve stavu „Čeká na schválení“ lze před potvrzením upravit.</p>
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
              <th>Akce</th>
            </tr>
          </thead>
          <tbody id="adminDirectoryRows">
            <tr><td colspan="10">Načítám členy…</td></tr>
          </tbody>
        </table>
      </div>

      <div class="admin-member-editor-backdrop" id="adminMemberEditor" hidden>
        <div class="admin-member-editor" role="dialog" aria-modal="true" aria-labelledby="adminMemberEditorTitle">
          <button class="admin-member-editor-close" type="button" data-close-member-editor aria-label="Zavřít">×</button>
          <span class="section-label">KONTROLA PŘIHLÁŠKY</span>
          <h3 id="adminMemberEditorTitle">Upravit přihlášku před schválením</h3>
          <p>Opravte údaje a teprve potom přihlášku schvalte. Po schválení je tento editor uzamčen.</p>

          <form id="adminMemberEditorForm" class="admin-member-editor-form">
            <input type="hidden" name="memberId">
            <div class="admin-member-editor-grid">
              <label>Jméno <input name="firstName" required></label>
              <label>Příjmení <input name="lastName" required></label>
              <label>E-mail <input name="email" type="email" required></label>
              <label>Telefon <input name="phone" required></label>
              <label>Kraj / okres <select name="region" required>${optionList(REGION_OPTIONS, 'Vyberte kraj')}</select></label>
              <label>Status rozhodčího <select name="refereeRole" required>${optionList(REFEREE_ROLES, 'Vyberte status')}</select></label>
              <label>ID FAČR <input name="facrId" inputmode="numeric" pattern="[0-9]+" required></label>
              <label>Listina rozhodčích <select name="refereeList" required>${optionList(REFEREE_LISTS, 'Vyberte listinu')}</select></label>
            </div>
            <p id="adminMemberEditorMessage" class="admin-member-editor-message" aria-live="polite"></p>
            <div class="admin-member-editor-actions">
              <button class="admin-member-editor-cancel" type="button" data-close-member-editor>Zrušit</button>
              <button class="admin-directory-export" type="submit">Uložit změny</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const firstMembersSection = shell.querySelector('.admin-panel-section');
    if (firstMembersSection?.after) firstMembersSection.after(section);
    else shell.appendChild(section);

    try {
      const users = await fetchUsers();
      users.sort((a, b) => `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`, 'cs'));

      section.querySelector('#adminDirectorySearch').addEventListener('input', () => applyFilter(section, users));
      section.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-edit-member]');
        if (editButton) {
          openEditor(section, users.find((user) => user.id === editButton.dataset.editMember));
          return;
        }

        if (event.target.closest('[data-close-member-editor]') || event.target.id === 'adminMemberEditor') {
          closeEditor(section);
        }
      });

      section.querySelector('#adminMemberEditorForm').addEventListener('submit', (event) => {
        event.preventDefault();
        saveMember(section, users, event.currentTarget);
      });

      section.querySelector('#adminMemberEditorForm').addEventListener('input', (event) => {
        event.target.setCustomValidity?.('');
      });

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
      section.querySelector('#adminDirectoryRows').innerHTML = `<tr><td colspan="10">${escapeHtml(error.message)}</td></tr>`;
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
