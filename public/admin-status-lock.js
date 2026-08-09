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
      html.theme-dark .admin-status-protected-note { color: #aebed2; }
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

  function scan(root = document) {
    if (root.matches?.('.admin-member-card')) lockCard(root);
    root.querySelectorAll?.('.admin-member-card').forEach(lockCard);
  }

  ensureStyles();
  scan();

  document.addEventListener('change', (event) => {
    if (event.target.matches?.('select[data-user-role]')) {
      lockCard(event.target.closest('.admin-member-card'));
    }
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
