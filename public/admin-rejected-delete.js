(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001'
      : window.location.origin);

  function isCzech() {
    return document.documentElement.lang !== 'en';
  }

  function ensureStyles() {
    if (document.getElementById('adminRejectedDeleteStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminRejectedDeleteStyles';
    style.textContent = `
      .admin-rejected-delete {
        margin-top: 10px;
        min-height: 42px;
        border: 1px solid #c5162e;
        border-radius: 10px;
        padding: 9px 14px;
        background: #fff;
        color: #b41528;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
      }
      .admin-rejected-delete:hover,
      .admin-rejected-delete:focus-visible {
        background: #c5162e;
        color: #fff;
      }
      .admin-rejected-delete:disabled {
        opacity: .55;
        cursor: wait;
      }
      html.theme-dark .admin-rejected-delete {
        background: transparent;
        color: #ff7180;
        border-color: #ff7180;
      }
      html.theme-dark .admin-rejected-delete:hover,
      html.theme-dark .admin-rejected-delete:focus-visible {
        background: #c5162e;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function memberName(card) {
    return String(card.querySelector('.admin-member-main h4, h4')?.textContent || '').trim();
  }

  function memberEmail(card) {
    return String(card.querySelector('.admin-member-main h4 + p')?.textContent || '').trim().split('·')[0].trim();
  }

  function currentToken() {
    return sessionStorage.getItem('cafr-admin-token') || '';
  }

  function updateVisibleCounters() {
    document.querySelectorAll('.admin-stats > div, .admin-stat, .admin-stat-card').forEach((stat) => {
      const text = String(stat.textContent || '').toLocaleLowerCase('cs-CZ');
      const number = stat.querySelector('b, strong, .admin-stat-number');
      if (!number) return;
      const value = Number.parseInt(number.textContent || '', 10);
      if (!Number.isFinite(value) || value <= 0) return;

      if (/registrovan/.test(text) || /registered/.test(text)) {
        number.textContent = String(value - 1);
      }
      if (/zamítn|zamitn|rejected/.test(text)) {
        number.textContent = String(value - 1);
      }
    });

    document.querySelectorAll('.admin-tab-button').forEach((button) => {
      const label = String(button.textContent || '').toLocaleLowerCase('cs-CZ');
      if (!/člen|clen|member/.test(label)) return;
      const count = button.querySelector('b');
      const value = Number.parseInt(count?.textContent || '', 10);
      if (count && Number.isFinite(value) && value > 0) count.textContent = String(value - 1);
    });
  }

  async function deleteRejected(card, button, userId) {
    const name = memberName(card) || (isCzech() ? 'tohoto uživatele' : 'this user');
    const email = memberEmail(card);
    const message = isCzech()
      ? `Opravdu chcete trvale smazat zamítnutou registraci ${name}${email ? ` (${email})` : ''}? Tuto akci nelze vrátit zpět.`
      : `Permanently delete the rejected registration for ${name}${email ? ` (${email})` : ''}? This action cannot be undone.`;

    if (!window.confirm(message)) return;

    const token = currentToken();
    if (!token) {
      window.alert(isCzech() ? 'Administrátorské přihlášení vypršelo. Přihlaste se znovu.' : 'Administrator session expired. Sign in again.');
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = isCzech() ? 'Mažu…' : 'Deleting…';

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);

      card.remove();
      updateVisibleCounters();
      window.dispatchEvent(new CustomEvent('ucfr-admin-member-deleted', { detail: { userId } }));
      window.alert(isCzech() ? 'Zamítnutá registrace byla smazána.' : 'Rejected registration was deleted.');
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      window.alert(`${isCzech() ? 'Registraci se nepodařilo smazat' : 'Could not delete registration'}: ${error.message}`);
    }
  }

  function syncCard(card) {
    const statusSelect = card.querySelector('[data-user-status]');
    if (!statusSelect) return;

    const userId = statusSelect.dataset.userStatus;
    const role = String(card.querySelector('[data-user-role]')?.value || '').toUpperCase();
    const shouldShow = String(statusSelect.value || '').toUpperCase() === 'REJECTED' && role !== 'ADMIN';
    let button = card.querySelector('.admin-rejected-delete');

    if (!shouldShow) {
      button?.remove();
      return;
    }

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-rejected-delete';
      button.textContent = isCzech() ? 'Smazat zamítnutou registraci' : 'Delete rejected registration';
      button.addEventListener('click', () => deleteRejected(card, button, userId));

      const controls = card.querySelector('.admin-member-controls');
      if (controls) controls.appendChild(button);
      else card.appendChild(button);
    }
  }

  function enhanceCard(card) {
    if (!card || card.dataset.rejectedDeleteEnhanced === 'true') {
      if (card) syncCard(card);
      return;
    }

    const statusSelect = card.querySelector('[data-user-status]');
    if (!statusSelect) return;

    card.dataset.rejectedDeleteEnhanced = 'true';
    statusSelect.addEventListener('change', () => window.setTimeout(() => syncCard(card), 0));
    card.querySelector('[data-user-role]')?.addEventListener('change', () => window.setTimeout(() => syncCard(card), 0));
    syncCard(card);
  }

  function scan(root = document) {
    if (root.matches?.('.admin-member-card')) enhanceCard(root);
    root.querySelectorAll?.('.admin-member-card').forEach(enhanceCard);
  }

  ensureStyles();
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
