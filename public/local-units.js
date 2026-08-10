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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function adminToken() {
    return sessionStorage.getItem('cafr-admin-token') || '';
  }

  function decodeRole(token) {
    try {
      const part = String(token || '').split('.')[1];
      if (!part) return '';
      const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      return String(JSON.parse(atob(padded))?.role || '').toUpperCase();
    } catch {
      return '';
    }
  }

  function isAdministrator() {
    return decodeRole(adminToken()) === 'ADMIN';
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);
    return data;
  }

  function ensureStyles() {
    if (document.getElementById('localUnitsStyles')) return;
    const style = document.createElement('style');
    style.id = 'localUnitsStyles';
    style.textContent = `
      #local-units.local-units-section {
        background: #f5f8fc;
      }
      .local-units-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 28px;
      }
      .local-unit-card {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
        padding: 20px;
        border: 1px solid #dbe5f0;
        border-radius: 18px;
        background: #fff;
        box-shadow: 0 10px 30px rgba(16, 42, 77, .05);
      }
      .local-unit-number {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 13px;
        background: #eaf3ff;
        color: #0b5aa5;
        font-weight: 800;
      }
      .local-unit-card h3 {
        margin: 1px 0 10px;
        color: #0f2340;
        font-size: 18px;
        line-height: 1.35;
      }
      .local-unit-responsible {
        margin: 0;
        color: #607086;
        line-height: 1.55;
      }
      .local-unit-responsible strong {
        color: #0f2340;
      }
      .local-units-empty,
      .local-units-error {
        grid-column: 1 / -1;
        padding: 20px;
        border-radius: 14px;
        background: #fff;
        color: #607086;
      }
      #adminLocalUnits .local-unit-admin-form {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) auto;
        gap: 12px;
        align-items: end;
        margin: 18px 0 22px;
        padding: 16px;
        border: 1px solid #dbe5f0;
        border-radius: 16px;
        background: rgba(244, 248, 252, .78);
      }
      #adminLocalUnits .local-unit-admin-form label {
        display: grid;
        gap: 7px;
        font-weight: 700;
      }
      #adminLocalUnits .local-unit-admin-form input {
        width: 100%;
        min-height: 44px;
        padding: 10px 12px;
        border: 1px solid #c9d6e5;
        border-radius: 10px;
        font: inherit;
      }
      #adminLocalUnits .local-unit-admin-list {
        display: grid;
        gap: 12px;
      }
      #adminLocalUnits .local-unit-admin-card {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: center;
        padding: 16px 18px;
        border: 1px solid #dbe5f0;
        border-radius: 14px;
      }
      #adminLocalUnits .local-unit-admin-card h4 {
        margin: 0 0 6px;
      }
      #adminLocalUnits .local-unit-admin-card p {
        margin: 0;
        color: #66758b;
      }
      #adminLocalUnits .local-unit-delete {
        flex: 0 0 auto;
        border: 1px solid #c5162e;
        border-radius: 10px;
        padding: 9px 13px;
        background: transparent;
        color: #b41528;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      #adminLocalUnits .local-unit-delete:hover {
        background: #c5162e;
        color: #fff;
      }
      #adminLocalUnits .local-unit-admin-message {
        min-height: 20px;
        margin: 0 0 12px;
        color: #52657d;
      }
      html.theme-dark #local-units.local-units-section,
      html.theme-dark .local-unit-card,
      html.theme-dark #adminLocalUnits .local-unit-admin-form,
      html.theme-dark #adminLocalUnits .local-unit-admin-card {
        background: #0d263e;
        border-color: #294864;
      }
      html.theme-dark .local-unit-card h3,
      html.theme-dark .local-unit-responsible strong,
      html.theme-dark #adminLocalUnits .local-unit-admin-card h4 {
        color: #f3f7fb;
      }
      html.theme-dark .local-unit-responsible,
      html.theme-dark #adminLocalUnits .local-unit-admin-card p,
      html.theme-dark #adminLocalUnits .local-unit-admin-message {
        color: #b6c4d3;
      }
      @media (max-width: 820px) {
        .local-units-grid { grid-template-columns: 1fr; }
        #adminLocalUnits .local-unit-admin-form { grid-template-columns: 1fr; }
      }
      @media (max-width: 560px) {
        .local-unit-card { grid-template-columns: 38px minmax(0, 1fr); padding: 16px; }
        .local-unit-number { width: 38px; height: 38px; }
        .local-unit-card h3 { font-size: 16px; }
        #adminLocalUnits .local-unit-admin-card { align-items: stretch; flex-direction: column; }
        #adminLocalUnits .local-unit-delete { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function publicSection() {
    let section = document.getElementById('local-units');
    if (section) return section;

    const documents = document.getElementById('documents');
    if (!documents) return null;

    section = document.createElement('section');
    section.id = 'local-units';
    section.className = 'section local-units-section';
    documents.insertAdjacentElement('beforebegin', section);
    return section;
  }

  function renderPublicUnits(units) {
    const section = publicSection();
    if (!section) return;
    const lang = isCzech() ? 'cs' : 'en';
    section.innerHTML = `
      <div class="section-head">
        <span>${lang === 'cs' ? 'ORGANIZAČNÍ STRUKTURA' : 'ORGANIZATIONAL STRUCTURE'}</span>
        <h2>${lang === 'cs' ? 'Lokální organizační jednotky' : 'Local organizational units'}</h2>
        <p>${lang === 'cs'
          ? 'Regionální a okresní organizační jednotky Unie českých fotbalových rozhodčích a jejich odpovědné osoby.'
          : 'Regional and district organizational units of the Union of Czech Football Referees and their responsible persons.'}</p>
      </div>
      <div class="local-units-grid">
        ${units.length ? units.map((unit, index) => `
          <article class="local-unit-card">
            <div class="local-unit-number">${index + 1}</div>
            <div>
              <h3>${escapeHtml(unit.name)}</h3>
              <p class="local-unit-responsible">
                <strong>${lang === 'cs' ? 'Odpovědné osoby:' : 'Responsible persons:'}</strong>
                ${escapeHtml((unit.responsiblePersons || []).join(', '))}
              </p>
            </div>
          </article>
        `).join('') : `<div class="local-units-empty">${lang === 'cs' ? 'Zatím nejsou evidovány žádné lokální jednotky.' : 'No local units are currently listed.'}</div>`}
      </div>
    `;
  }

  async function refreshPublic() {
    try {
      const units = await request('/api/local-units');
      renderPublicUnits(Array.isArray(units) ? units : []);
    } catch (error) {
      const section = publicSection();
      if (!section) return;
      section.innerHTML = `
        <div class="section-head">
          <span>ORGANIZAČNÍ STRUKTURA</span>
          <h2>${isCzech() ? 'Lokální organizační jednotky' : 'Local organizational units'}</h2>
        </div>
        <div class="local-units-grid"><div class="local-units-error">${escapeHtml(error.message)}</div></div>
      `;
    }
  }

  function adminSection(shell) {
    if (!isAdministrator()) return null;
    let section = shell.querySelector(':scope > #adminLocalUnits');
    if (section) return section;

    section = document.createElement('section');
    section.id = 'adminLocalUnits';
    section.className = 'admin-panel-section';
    section.dataset.adminTab = 'units';
    section.innerHTML = `
      <div class="admin-section-head">
        <div>
          <span class="section-label">LOKÁLNÍ JEDNOTKY</span>
          <h3>${isCzech() ? 'Lokální organizační jednotky' : 'Local organizational units'}</h3>
        </div>
        <span class="admin-count">0</span>
      </div>
      <form class="local-unit-admin-form" id="localUnitAdminForm">
        <label>
          <span>${isCzech() ? 'Název jednotky' : 'Unit name'}</span>
          <input name="name" required placeholder="Unie českých fotbalových rozhodčích OFS …">
        </label>
        <label>
          <span>${isCzech() ? 'Odpovědné osoby' : 'Responsible persons'}</span>
          <input name="responsiblePersons" required placeholder="Jméno Příjmení, Jméno Příjmení">
        </label>
        <button class="primary" type="submit">${isCzech() ? 'Přidat jednotku' : 'Add unit'}</button>
      </form>
      <p class="local-unit-admin-message" aria-live="polite"></p>
      <div class="local-unit-admin-list"></div>
    `;

    shell.appendChild(section);

    section.querySelector('#localUnitAdminForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = section.querySelector('.local-unit-admin-message');
      const data = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      message.textContent = isCzech() ? 'Ukládám…' : 'Saving…';
      try {
        await request('/api/admin/local-units', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken()}` },
          body: JSON.stringify({
            name: data.get('name'),
            responsiblePersons: data.get('responsiblePersons'),
          }),
        });
        form.reset();
        message.textContent = isCzech() ? 'Jednotka byla přidána.' : 'Unit added.';
        await refreshAll();
      } catch (error) {
        message.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

    section.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-local-unit]');
      if (!button) return;
      const name = button.dataset.unitName || '';
      const confirmed = window.confirm(isCzech()
        ? `Opravdu chcete smazat organizační jednotku „${name}“?`
        : `Delete the organizational unit “${name}”?`);
      if (!confirmed) return;

      button.disabled = true;
      try {
        await request(`/api/admin/local-units/${encodeURIComponent(button.dataset.deleteLocalUnit)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken()}` },
        });
        await refreshAll();
      } catch (error) {
        window.alert(error.message);
        button.disabled = false;
      }
    });

    return section;
  }

  function renderAdminUnits(shell, units) {
    const section = adminSection(shell);
    if (!section) return;
    const list = section.querySelector('.local-unit-admin-list');
    const count = section.querySelector('.admin-count');
    if (count) count.textContent = String(units.length);
    if (!list) return;

    list.innerHTML = units.length ? units.map((unit) => `
      <article class="local-unit-admin-card">
        <div>
          <h4>${escapeHtml(unit.name)}</h4>
          <p><strong>${isCzech() ? 'Odpovědné osoby:' : 'Responsible persons:'}</strong> ${escapeHtml((unit.responsiblePersons || []).join(', '))}</p>
        </div>
        <button
          type="button"
          class="local-unit-delete"
          data-delete-local-unit="${escapeHtml(unit.id)}"
          data-unit-name="${escapeHtml(unit.name)}"
        >${isCzech() ? 'Smazat' : 'Delete'}</button>
      </article>
    `).join('') : `<div class="empty-results">${isCzech() ? 'Žádné organizační jednotky.' : 'No organizational units.'}</div>`;
  }

  async function refreshAdmin() {
    if (!isAdministrator()) return;
    const shells = [...document.querySelectorAll('.admin-shell')];
    if (!shells.length) return;
    try {
      const units = await request('/api/admin/local-units', {
        headers: { Authorization: `Bearer ${adminToken()}` },
      });
      shells.forEach((shell) => renderAdminUnits(shell, Array.isArray(units) ? units : []));
    } catch (error) {
      shells.forEach((shell) => {
        const section = adminSection(shell);
        const message = section?.querySelector('.local-unit-admin-message');
        if (message) message.textContent = error.message;
      });
    }
  }

  async function refreshAll() {
    await Promise.all([refreshPublic(), refreshAdmin()]);
    window.dispatchEvent(new CustomEvent('ucfr-local-units-updated'));
  }

  ensureStyles();
  refreshPublic();
  refreshAdmin();

  window.addEventListener('pageshow', refreshPublic);
  window.addEventListener('ucfr-local-units-updated', () => window.setTimeout(refreshAdmin, 0));

  let frame = null;
  const observer = new MutationObserver((mutations) => {
    let adminAdded = false;
    let documentsAdded = false;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('.admin-shell') || node.querySelector?.('.admin-shell')) adminAdded = true;
        if (node.id === 'documents' || node.querySelector?.('#documents')) documentsAdded = true;
      });
    }
    if ((!adminAdded && !documentsAdded) || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (documentsAdded) refreshPublic();
      if (adminAdded) refreshAdmin();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
