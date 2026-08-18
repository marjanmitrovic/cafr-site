(() => {
  'use strict';

  const BUTTON_ID = 'adminMembershipExportTop';
  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : window.location.origin
    );

  function adminToken() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function memberNumber(user) {
    return `UCFR-${String(user?.id || '').slice(-8).toUpperCase()}`;
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

  function safeSpreadsheetValue(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  }

  function csvValue(value) {
    return `"${safeSpreadsheetValue(value).replace(/"/g, '""')}"`;
  }

  function downloadCsv(users) {
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
      .map((row) => row.map(csvValue).join(';'))
      .join('\r\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ucfr-schvaleni-clenove-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function exportMembership() {
    const token = adminToken();
    if (!token) throw new Error('Chybí administrátorský token. Přihlaste se znovu.');

    const params = new URLSearchParams({
      export: '1',
      status: 'APPROVED',
    });

    const response = await fetch(`${API_BASE}/api/admin/users-page?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Databázi členů nelze načíst.');

    const users = Array.isArray(data.users)
      ? data.users.filter((user) => user.membershipStatus === 'APPROVED')
      : [];

    users.sort((a, b) => `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`, 'cs'));
    downloadCsv(users);
    return users.length;
  }

  function injectButton() {
    const adminHead = document.querySelector('.admin-shell .admin-head');
    if (!adminHead) return false;
    if (document.getElementById(BUTTON_ID)) return true;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'primary small';
    button.textContent = 'Export schválených členů (.CSV)';
    button.style.marginLeft = 'auto';
    button.style.minHeight = '42px';
    button.style.padding = '0 16px';
    button.style.whiteSpace = 'nowrap';
    button.style.fontWeight = '700';

    const logoutButton = adminHead.querySelector('#adminLogout');
    if (logoutButton) adminHead.insertBefore(button, logoutButton);
    else adminHead.appendChild(button);

    button.addEventListener('click', async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Připravuji CSV…';

      try {
        const count = await exportMembership();
        button.textContent = `Exportováno: ${count} schválených členů`;
      } catch (error) {
        console.error('Top membership export error:', error);
        button.textContent = error.message || 'Export se nezdařil';
      }

      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 2200);
    });

    return true;
  }

  injectButton();

  const observer = new MutationObserver(() => {
    injectButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
