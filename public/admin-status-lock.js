(() => {
  'use strict';

  function ensureStyles() {
    if (document.getElementById('adminStatusProtectedStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminStatusProtectedStyles';
    style.textContent = `
      select.admin-status-protected,
      select.admin-role-protected {
        opacity: .65;
        cursor: not-allowed;
      }
      .admin-status-protected-note {
        display: block;
        margin-top: 5px;
        color: #667085;
        font-size: 11px;
        font-weight: 700;
      }
      .admin-membership-status-check {
        margin: 10px 0 0;
        color: #667085;
        font-size: 13px;
        font-weight: 600;
      }
      html.theme-dark .admin-status-protected-note,
      html.theme-dark .admin-membership-status-check { color: #aebed2; }
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

    setProtected(
      statusSelect,
      isAdmin,
      'admin-status-protected',
      'Stav administrátora nelze měnit v běžné administraci.'
    );
    setProtected(
      roleSelect,
      isAdmin,
      'admin-role-protected',
      'Roli administrátora nelze měnit v běžné administraci.'
    );

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

  function isCzech() {
    return document.documentElement.lang !== 'en';
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
    const number = card.querySelector('b');
    const text = card.querySelector('span');
    if (number && number.textContent !== String(value)) number.textContent = String(value);
    if (text && text.textContent !== label) text.textContent = label;
  }

  function updateMembershipStats(shell) {
    const stats = shell?.querySelector(':scope > .admin-stats');
    const section = shell ? findPrimaryMemberSection(shell) : null;
    if (!stats || !section) return;

    const byUser = new Map();
    section.querySelectorAll('select[data-user-status]').forEach((select) => {
      const id = select.dataset.userStatus;
      if (id) byUser.set(id, String(select.value || '').toUpperCase());
    });
    if (!byUser.size) return;

    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
    byUser.forEach((status) => {
      if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    });

    const originalCards = [...stats.querySelectorAll(':scope > article:not([data-membership-stat])')];
    const totalCard = originalCards[0];
    const pendingCard = originalCards[1];
    const approvedCard = originalCards[2];

    if (totalCard) {
      const b = totalCard.querySelector('b');
      const span = totalCard.querySelector('span');
      if (b) b.textContent = String(byUser.size);
      if (span) span.textContent = isCzech() ? 'registrovaných osob celkem' : 'registered users total';
    }
    if (pendingCard?.querySelector('b')) pendingCard.querySelector('b').textContent = String(counts.PENDING);
    if (approvedCard?.querySelector('b')) approvedCard.querySelector('b').textContent = String(counts.APPROVED);

    ensureStatCard(
      stats,
      'rejected',
      counts.REJECTED,
      isCzech() ? 'zamítnutých registrací' : 'rejected registrations'
    );
    ensureStatCard(
      stats,
      'suspended',
      counts.SUSPENDED,
      isCzech() ? 'pozastavených členství' : 'suspended memberships'
    );

    const sum = counts.PENDING + counts.APPROVED + counts.REJECTED + counts.SUSPENDED;
    let check = stats.nextElementSibling;
    if (!check?.classList?.contains('admin-membership-status-check')) {
      check = document.createElement('p');
      check.className = 'admin-membership-status-check';
      stats.after(check);
    }
    check.textContent = isCzech()
      ? `Kontrola: ${counts.APPROVED} schváleno + ${counts.PENDING} čeká + ${counts.REJECTED} zamítnuto + ${counts.SUSPENDED} pozastaveno = ${sum}`
      : `Check: ${counts.APPROVED} approved + ${counts.PENDING} pending + ${counts.REJECTED} rejected + ${counts.SUSPENDED} suspended = ${sum}`;
  }

  function scan(root = document) {
    if (root.matches?.('.admin-member-card')) lockCard(root);
    root.querySelectorAll?.('.admin-member-card').forEach(lockCard);

    const shells = [];
    if (root.matches?.('.admin-shell')) shells.push(root);
    root.querySelectorAll?.('.admin-shell').forEach((shell) => shells.push(shell));
    const closest = root.closest?.('.admin-shell');
    if (closest) shells.push(closest);
    [...new Set(shells)].forEach(updateMembershipStats);
  }

  ensureStyles();
  scan();

  document.addEventListener('change', (event) => {
    if (event.target.matches?.('select[data-user-role]')) {
      lockCard(event.target.closest('.admin-member-card'));
    }
    if (event.target.matches?.('select[data-user-status], select[data-user-role]')) {
      updateMembershipStats(event.target.closest('.admin-shell'));
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
