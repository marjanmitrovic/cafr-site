(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : window.location.origin);

  const summaryState = new WeakMap();

  function isCzech() {
    return document.documentElement.lang !== 'en';
  }

  function adminToken() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function ensureStyles() {
    if (document.getElementById('adminStatusProtectedStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminStatusProtectedStyles';
    style.textContent = `
      select.admin-status-protected,
      select.admin-role-protected { opacity:.65; cursor:not-allowed; }
      .admin-status-protected-note { display:block; margin-top:5px; color:#667085; font-size:11px; font-weight:700; }
      .admin-membership-status-check { margin:10px 0 0; color:#667085; font-size:13px; font-weight:600; }
      html.theme-dark .admin-status-protected-note,
      html.theme-dark .admin-membership-status-check { color:#aebed2; }
    `;
    document.head.appendChild(style);
  }

  function setProtected(select, protectedState, className, title) {
    if (!select) return;
    if (protectedState) {
      select.disabled = true;
      select.dataset.adminProtected = 'true';
      select.classList.add(className);
      select.title = title;
      return;
    }
    if (select.dataset.adminProtected === 'true') {
      select.disabled = false;
      delete select.dataset.adminProtected;
    }
    select.classList.remove(className);
    if (select.title === title) select.title = '';
  }

  function lockCard(card) {
    if (!card) return;
    const roleSelect = card.querySelector('select[data-user-role]');
    const statusSelect = card.querySelector('select[data-user-status]');
    if (!roleSelect || !statusSelect) return;

    const isAdmin = String(roleSelect.value || '').toUpperCase() === 'ADMIN';
    setProtected(statusSelect, isAdmin, 'admin-status-protected', 'Stav administrátora nelze měnit v běžné administraci.');
    setProtected(roleSelect, isAdmin, 'admin-role-protected', 'Roli administrátora nelze měnit v běžné administraci.');

    let note = card.querySelector('.admin-status-protected-note');
    if (isAdmin) {
      if (!note) {
        note = document.createElement('small');
        note.className = 'admin-status-protected-note';
        roleSelect.insertAdjacentElement('afterend', note);
      }
      note.textContent = 'Status a role administrátora jsou chráněny.';
    } else if (note) {
      note.remove();
    }
  }

  function findPrimaryMemberSection(shell) {
    return [...shell.querySelectorAll(':scope > .admin-panel-section')].find((section) => {
      const heading = String(section.querySelector('h3')?.textContent || '').toLowerCase();
      return heading.includes('registrovan') || heading.includes('registered member');
    }) || null;
  }

  function ensureStatCard(stats, key, value, label) {
    let card = stats.querySelector(`[data-membership-stat="${key}"]`);
    if (!card) {
      card = document.createElement('article');
      card.dataset.membershipStat = key;
      card.innerHTML = '<b></b><span></span>';
      stats.appendChild(card);
    }
    card.querySelector('b').textContent = String(value);
    card.querySelector('span').textContent = label;
  }

  function applySummary(shell, data) {
    const stats = shell?.querySelector(':scope > .admin-stats');
    const section = shell ? findPrimaryMemberSection(shell) : null;
    if (!stats || !section) return;

    const cards = [...stats.querySelectorAll(':scope > article:not([data-membership-stat])')];
    const totalCard = cards[0];
    const pendingCard = cards[1];
    const approvedCard = cards[2];

    if (totalCard) {
      totalCard.querySelector('b').textContent = String(data.total ?? 0);
      totalCard.querySelector('span').textContent = isCzech() ? 'registrovaných osob celkem' : 'registered users total';
    }
    if (pendingCard?.querySelector('b')) pendingCard.querySelector('b').textContent = String(data.pending ?? 0);
    if (approvedCard?.querySelector('b')) approvedCard.querySelector('b').textContent = String(data.approved ?? 0);

    ensureStatCard(stats, 'rejected', data.rejected ?? 0, isCzech() ? 'zamítnutých registrací' : 'rejected registrations');
    ensureStatCard(stats, 'suspended', data.suspended ?? 0, isCzech() ? 'pozastavených členství' : 'suspended memberships');

    section.querySelector('.admin-count')?.replaceChildren(document.createTextNode(String(data.total ?? 0)));
    const tabCount = shell.querySelector('[data-admin-tab-target="members"] b');
    if (tabCount) tabCount.textContent = String(data.total ?? 0);

    let check = stats.nextElementSibling;
    if (!check?.classList?.contains('admin-membership-status-check')) {
      check = document.createElement('p');
      check.className = 'admin-membership-status-check';
      stats.after(check);
    }
    check.textContent = isCzech()
      ? `Kontrola: ${data.approved ?? 0} schváleno + ${data.pending ?? 0} čeká + ${data.rejected ?? 0} zamítnuto + ${data.suspended ?? 0} pozastaveno = ${data.total ?? 0}`
      : `Check: ${data.approved ?? 0} approved + ${data.pending ?? 0} pending + ${data.rejected ?? 0} rejected + ${data.suspended ?? 0} suspended = ${data.total ?? 0}`;
  }

  async function refreshSummary(shell, force = false) {
    if (!shell || !findPrimaryMemberSection(shell)) return;
    const previous = summaryState.get(shell);
    if (!force && previous?.loading) return;

    const token = adminToken();
    if (!token) return;
    summaryState.set(shell, { loading: true, data: previous?.data || null });

    try {
      const response = await fetch(`${API_BASE}/api/admin/users-page?summary=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load membership summary');
      summaryState.set(shell, { loading: false, data });
      applySummary(shell, data);
    } catch (error) {
      console.warn('Membership summary refresh failed:', error);
      summaryState.set(shell, { loading: false, data: previous?.data || null });
    }
  }

  function scan(root = document) {
    if (root.matches?.('.admin-member-card')) lockCard(root);
    root.querySelectorAll?.('.admin-member-card').forEach(lockCard);

    const shells = new Set();
    if (root.matches?.('.admin-shell')) shells.add(root);
    root.querySelectorAll?.('.admin-shell').forEach((shell) => shells.add(shell));
    const closest = root.closest?.('.admin-shell');
    if (closest) shells.add(closest);
    shells.forEach((shell) => refreshSummary(shell));
  }

  ensureStyles();
  scan();

  document.addEventListener('change', (event) => {
    if (event.target.matches?.('select[data-user-role]')) lockCard(event.target.closest('.admin-member-card'));
    if (event.target.matches?.('select[data-user-status]')) {
      const shell = event.target.closest('.admin-shell');
      window.setTimeout(() => refreshSummary(shell, true), 500);
    }
  });

  let frame = null;
  const pendingRoots = new Set();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) pendingRoots.add(node);
      });
      const shell = mutation.target?.closest?.('.admin-shell');
      if (shell) pendingRoots.add(shell);
    }
    if (frame !== null || !pendingRoots.size) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach(scan);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
