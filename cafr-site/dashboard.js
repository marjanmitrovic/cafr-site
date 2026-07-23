import './style.css';

const API_BASE = localStorage.getItem('cafr-api-base') || 'http://localhost:3001';
const app = document.querySelector('#dashboardApp');
const token = localStorage.getItem('cafr-token');
let user = null;
let statusSyncTimer = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function cardNumber(member) {
  return `UCFR-${String(member.id).slice(-8).toUpperCase()}`;
}

function verificationUrl(member) {
  return `${window.location.origin}/verify.html?member=${encodeURIComponent(member.id)}`;
}

function qrUrl(member) {
  return 'https://api.qrserver.com/v1/create-qr-code/' +
    `?size=260x260&margin=10&data=${encodeURIComponent(verificationUrl(member))}`;
}


function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Soubor nelze načíst: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function collectAttachments(input) {
  const files = Array.from(input?.files || []);
  if (files.length > 5) {
    throw new Error('Maximálně 5 příloh.');
  }

  const maxBytes = 8 * 1024 * 1024;
  const allowed = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ]);

  const attachments = [];
  for (const file of files) {
    if (!allowed.has(file.type)) {
      throw new Error(`Nepodporovaný typ souboru: ${file.name}`);
    }
    if (file.size > maxBytes) {
      throw new Error(`Soubor je příliš velký: ${file.name}`);
    }
    attachments.push({
      fileName: file.name,
      fileData: await fileToDataUrl(file),
    });
  }
  return attachments;
}

function renderAttachments(attachments = []) {
  if (!attachments?.length) return '';
  return `
    <div class="attachment-list">
      <strong>Přílohy</strong>
      ${attachments.map((attachment) => `
        <a href="${escapeHtml(attachment.fileUrl)}" target="_blank" rel="noopener">
          📎 ${escapeHtml(attachment.fileName)}
          <small>${Math.ceil(Number(attachment.sizeBytes || 0) / 1024)} KB</small>
        </a>
      `).join('')}
    </div>
  `;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function logout() {
  localStorage.removeItem('cafr-token');
  localStorage.removeItem('cafr-user');
  window.location.href = '/';
}

function renderDashboard() {
  const approved = user.membershipStatus === 'APPROVED';
  const statusText = {
    PENDING: 'Čeká na schválení',
    APPROVED: 'Členství schváleno',
    REJECTED: 'Přihláška zamítnuta',
    SUSPENDED: 'Členství pozastaveno'
  }[user.membershipStatus] || user.membershipStatus;

  app.innerHTML = `
    <div class="dashboard-layout">
      <aside class="dashboard-sidebar">
        <a class="dashboard-brand" href="/"><img src="/assets/ucfr-logo.svg" alt="UČFR"><span>UČFR</span></a>
        <nav class="dashboard-nav">
          <button class="active" data-view="overview">Přehled</button>
          <button data-view="card">Členský průkaz</button>
          <button data-view="results">Moje testy</button>
          <button data-view="incidents">Incidenty</button>
          <button data-view="seminars">Semináře</button>
          <button data-view="fees">Členské příspěvky</button>
          <button data-view="legal">Právní podpora</button>
          <button data-view="notifications">Oznámení <span class="notification-badge" id="notificationBadge" hidden>0</span></button>
          <button data-view="documents">Dokumenty</button>
          <button data-view="profile">Můj profil</button>
          ${['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(user.role) ? `
            <button id="openAdminBtn" type="button">Administrace</button>
          ` : ''}
        </nav>
        <button class="dashboard-logout" id="logoutBtn">Odhlásit se</button>
      </aside>

      <main class="dashboard-main">
        <header class="dashboard-header">
          <div><small>ČLENSKÁ SEKCE</small><h1>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</h1></div>
          <div class="dashboard-status-actions">
            <button class="secondary dark dashboard-refresh-status" id="refreshStatusBtn" type="button">Obnovit stav</button>
            <span class="profile-status profile-status-${user.membershipStatus.toLowerCase()}">${escapeHtml(statusText)}</span>
          </div>
        </header>
        <div id="dashboardView"></div>
      </main>
    </div>
  `;

  document.querySelector('#logoutBtn').onclick = logout;

  const openAdminBtn = document.querySelector('#openAdminBtn');
  if (openAdminBtn) {
    openAdminBtn.onclick = () => {
      sessionStorage.setItem('cafr-admin-token', token);
      window.location.href = '/?admin=1';
    };
  }

  const refreshStatusBtn = document.querySelector('#refreshStatusBtn');
  if (refreshStatusBtn) refreshStatusBtn.onclick = () => refreshCurrentUser(true);
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('[data-view]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      renderView(button.dataset.view, approved);
    };
  });
  const hashView = window.location.hash.replace('#', '');
  const allowedViews = ['overview','card','results','incidents','seminars','fees','legal','notifications','documents','profile'];
  const initialView = allowedViews.includes(hashView) ? hashView : 'overview';
  const initialButton = document.querySelector(`[data-view="${initialView}"]`);
  if (initialButton) {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.remove('active'));
    initialButton.classList.add('active');
  }
  renderView(initialView, approved);
  refreshNotificationBadge();
}

function renderView(view, approved) {
  const target = document.querySelector('#dashboardView');

  if (view === 'overview') {
    target.innerHTML = `
      <section class="dashboard-grid">
        <article class="dashboard-panel"><small>Číslo průkazu</small><strong>${cardNumber(user)}</strong></article>
        <article class="dashboard-panel"><small>Role</small><strong>${escapeHtml(user.role)}</strong></article>
        <article class="dashboard-panel"><small>Region</small><strong>${escapeHtml(user.region || '—')}</strong></article>
        <article class="dashboard-panel"><small>Status rozhodčího</small><strong>${escapeHtml(user.refereeStatus || '—')}</strong></article>
      </section>
      <section class="dashboard-panel dashboard-welcome">
        <h2>Vítejte v členské sekci</h2>
        <p>${approved ? 'Váš členský účet je aktivní. Můžete používat členský průkaz, výsledky testů a členské dokumenty.' : 'Po schválení Výkonným výborem budou zpřístupněny všechny členské funkce.'}</p>
      </section>
    `;
    return;
  }

  if (view === 'card') {
    target.innerHTML = `
      <section class="dashboard-panel digital-card-panel">
        <div class="digital-member-card">
          <div class="digital-card-head"><img src="/assets/ucfr-logo.svg" alt="UČFR"><span>ČLENSKÝ PRŮKAZ</span></div>
          <h2>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</h2>
          <p>${cardNumber(user)}</p>
          <img class="dashboard-qr" src="${qrUrl(user)}" alt="QR kód členského průkazu">
          <small>${approved ? 'PLATNÝ ČLEN' : 'NEAKTIVNÍ / ČEKÁ NA SCHVÁLENÍ'}</small>
        </div>
        <p>Po naskenování QR kódu se otevře veřejná stránka ověření členství.</p>
      </section>
    `;
    return;
  }

  if (view === 'results') {
    loadResults(target);
    return;
  }

  if (view === 'incidents') {
    renderIncidents(target, approved);
    return;
  }

  if (view === 'seminars') {
    loadSeminars(target, approved);
    return;
  }

  if (view === 'fees') {
    loadMembershipFees(target, approved);
    return;
  }

  if (view === 'legal') {
    loadLegalRequests(target, approved);
    return;
  }

  if (view === 'notifications') {
    loadNotifications(target);
    return;
  }

  if (view === 'documents') {
    loadDocuments(target, approved);
    return;
  }

  if (view === 'profile') {
    target.innerHTML = `
      <section class="dashboard-panel">
        <h2>Můj profil</h2>
        <form id="profileForm" class="form">
          <div class="form-row"><label>Jméno<input name="firstName" value="${escapeHtml(user.firstName)}" required></label><label>Příjmení<input name="lastName" value="${escapeHtml(user.lastName)}" required></label></div>
          <div class="form-row"><label>Telefon<input name="phone" value="${escapeHtml(user.phone || '')}"></label><label>Region<input name="region" value="${escapeHtml(user.region || '')}"></label></div>
          <label>Status rozhodčího<input name="refereeStatus" value="${escapeHtml(user.refereeStatus || '')}"></label>
          <button class="primary" type="submit">Uložit změny</button><p id="profileMessage"></p>
        </form>
      </section>
      <section class="dashboard-panel">
        <h2>Změna hesla</h2>
        <form id="passwordForm" class="form">
          <label>Současné heslo<input name="currentPassword" type="password" required></label>
          <label>Nové heslo<input name="newPassword" type="password" minlength="8" required></label>
          <label>Nové heslo znovu<input name="confirmPassword" type="password" minlength="8" required></label>
          <button class="primary" type="submit">Změnit heslo</button>
          <p id="passwordMessage"></p>
        </form>
      </section>
    `;
    document.querySelector('#profileForm').onsubmit = saveProfile;
    document.querySelector('#passwordForm').onsubmit = changePassword;
  }
}

async function loadResults(target) {
  target.innerHTML = '<section class="dashboard-panel"><div class="loading-state">Načítám výsledky…</div></section>';
  try {
    const attempts = await fetch(`${API_BASE}/api/results/${encodeURIComponent(user.id)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Results failed');
      return data;
    });
    target.innerHTML = `
      <section class="dashboard-panel"><h2>Moje testy</h2>
        ${attempts.length ? `<div class="results-table">${attempts.map((attempt) => `<div class="results-row"><span>${new Date(attempt.createdAt).toLocaleDateString('cs-CZ')}</span><span>${escapeHtml(attempt.mode)}</span><span><b>${attempt.percent}%</b></span><span>${Math.floor(attempt.duration / 60)}:${String(attempt.duration % 60).padStart(2, '0')}</span></div>`).join('')}</div>` : '<p>Zatím nemáte uložené výsledky.</p>'}
      </section>`;
  } catch (error) {
    target.innerHTML = `<section class="dashboard-panel"><h2>Výsledky nelze načíst</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const message = document.querySelector('#profileMessage');
  message.textContent = 'Ukládám…';
  try {
    const result = await api('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        phone: data.get('phone'),
        region: data.get('region'),
        refereeStatus: data.get('refereeStatus')
      })
    });
    user = result.user;
    localStorage.setItem('cafr-user', JSON.stringify(user));
    message.textContent = 'Změny byly uloženy.';
  } catch (error) {
    message.textContent = error.message;
  }
}



async function changePassword(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const message = document.querySelector('#passwordMessage');
  const newPassword = String(data.get('newPassword') || '');
  const confirmPassword = String(data.get('confirmPassword') || '');

  if (newPassword !== confirmPassword) {
    message.textContent = 'Nová hesla se neshodují.';
    return;
  }

  message.textContent = 'Ukládám…';
  try {
    await api('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({
        currentPassword: data.get('currentPassword'),
        newPassword
      })
    });
    event.currentTarget.reset();
    message.textContent = 'Heslo bylo změněno.';
  } catch (error) {
    message.textContent = error.message;
  }
}

async function refreshNotificationBadge() {
  const badge = document.querySelector('#notificationBadge');
  if (!badge) return;

  try {
    const result = await api('/api/notifications/me');
    badge.textContent = String(result.unreadCount || 0);
    badge.hidden = !result.unreadCount;
  } catch {
    badge.hidden = true;
  }
}


async function loadSeminars(target, approved) {
  target.innerHTML = '<section class="dashboard-panel"><div class="loading-state">Načítám semináře…</div></section>';
  try {
    const seminars = await api('/api/seminars');
    target.innerHTML = `
      <section class="dashboard-panel">
        <div class="notifications-head"><div><small>VZDĚLÁVÁNÍ</small><h2>Semináře a akce</h2></div></div>
        ${seminars.length ? `<div class="seminar-list">${seminars.map((item) => {
          const registered = item.myRegistration?.status === 'REGISTERED';
          const full = item.capacity && item.registrationCount >= item.capacity;
          return `<article class="seminar-card">
            <div><small>${new Date(item.startsAt).toLocaleString('cs-CZ')}</small><h3>${escapeHtml(item.titleCs)}</h3><p>${escapeHtml(item.descriptionCs || '')}</p><p><b>${escapeHtml(item.location)}</b> · ${item.registrationCount}${item.capacity ? ` / ${item.capacity}` : ''} přihlášených</p></div>
            <div>${registered ? `<button class="secondary dark" data-cancel-seminar="${item.id}" type="button">Zrušit přihlášení</button>` : `<button class="primary" data-register-seminar="${item.id}" type="button" ${(!approved || full || item.status !== 'PUBLISHED') ? 'disabled' : ''}>${full ? 'Kapacita naplněna' : 'Přihlásit se'}</button>`}</div>
          </article>`;
        }).join('')}</div>` : '<p>Aktuálně nejsou vypsány žádné semináře.</p>'}
      </section>`;

    document.querySelectorAll('[data-register-seminar]').forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try { await api(`/api/seminars/${button.dataset.registerSeminar}/register`, { method: 'POST' }); await loadSeminars(target, approved); refreshNotificationBadge(); }
        catch (error) { alert(error.message); button.disabled = false; }
      };
    });
    document.querySelectorAll('[data-cancel-seminar]').forEach((button) => {
      button.onclick = async () => {
        if (!confirm('Opravdu zrušit přihlášení?')) return;
        try { await api(`/api/seminars/${button.dataset.cancelSeminar}/register`, { method: 'DELETE' }); await loadSeminars(target, approved); }
        catch (error) { alert(error.message); }
      };
    });
  } catch (error) {
    target.innerHTML = `<section class="dashboard-panel"><h2>Semináře nelze načíst</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

async function loadNotifications(target) {
  target.innerHTML = '<section class="dashboard-panel"><div class="loading-state">Načítám oznámení…</div></section>';

  try {
    const result = await api('/api/notifications/me');
    const notifications = result.notifications || [];

    target.innerHTML = `
      <section class="dashboard-panel">
        <div class="notifications-head">
          <div><small>ČLENSKÁ SEKCE</small><h2>Oznámení</h2></div>
          ${result.unreadCount ? '<button class="secondary dark" id="readAllNotifications" type="button">Označit vše jako přečtené</button>' : ''}
        </div>
        ${notifications.length ? `
          <div class="notification-list">
            ${notifications.map((item) => `
              <article class="notification-item ${item.isRead ? '' : 'unread'}" data-notification-id="${item.id}">
                <div class="notification-dot"></div>
                <div>
                  <div class="notification-title-row">
                    <strong>${escapeHtml(item.title)}</strong>
                    <time>${new Date(item.createdAt).toLocaleString('cs-CZ')}</time>
                  </div>
                  <p>${escapeHtml(item.message)}</p>
                  ${item.link ? `<a href="${escapeHtml(item.link)}" data-notification-link="${item.id}">Otevřít</a>` : ''}
                </div>
              </article>
            `).join('')}
          </div>
        ` : '<p>Zatím nemáte žádná oznámení.</p>'}
      </section>
    `;

    document.querySelector('#readAllNotifications')?.addEventListener('click', async () => {
      await api('/api/notifications/read-all', { method: 'PATCH' });
      await loadNotifications(target);
      await refreshNotificationBadge();
    });

    document.querySelectorAll('[data-notification-link]').forEach((link) => {
      link.addEventListener('click', async () => {
        try {
          await api(`/api/notifications/${link.dataset.notificationLink}/read`, { method: 'PATCH' });
        } catch {
          // Navigation should continue even if marking as read fails.
        }
      });
    });
  } catch (error) {
    target.innerHTML = `<section class="dashboard-panel"><h2>Oznámení nelze načíst</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}


async function refreshCurrentUser(showMessage = false) {
  try {
    const previousStatus = user?.membershipStatus;
    const previousRole = user?.role;
    const result = await api('/api/auth/me');
    const freshUser = result.user;

    localStorage.setItem('cafr-user', JSON.stringify(freshUser));

    const changed =
      previousStatus !== freshUser.membershipStatus ||
      previousRole !== freshUser.role;

    user = freshUser;

    if (changed) {
      renderDashboard();
      const message = freshUser.membershipStatus === 'APPROVED'
        ? 'Vaše členství bylo schváleno. Členské funkce jsou nyní aktivní.'
        : `Stav členství byl změněn na ${freshUser.membershipStatus}.`;
      window.setTimeout(() => window.alert(message), 50);
      return;
    }

    if (showMessage) {
      const button = document.querySelector('#refreshStatusBtn');
      if (button) {
        const original = button.textContent;
        button.textContent = 'Stav je aktuální';
        button.disabled = true;
        window.setTimeout(() => {
          button.textContent = original;
          button.disabled = false;
        }, 1400);
      }
    }
  } catch (error) {
    if (showMessage) window.alert(error.message || 'Stav nelze obnovit.');
  }
}

function startStatusSync() {
  if (statusSyncTimer) window.clearInterval(statusSyncTimer);
  statusSyncTimer = window.setInterval(() => refreshCurrentUser(false), 30000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshCurrentUser(false);
  });

  window.addEventListener('focus', () => refreshCurrentUser(false));
}

async function init() {
  if (!token) {
    window.location.href = '/';
    return;
  }
  app.innerHTML = '<div class="portal-loading">Načítám členskou sekci…</div>';
  try {
    const result = await api('/api/auth/me');
    user = result.user;
    localStorage.setItem('cafr-user', JSON.stringify(user));
    renderDashboard();
    startStatusSync();
  } catch {
    logout();
  }
}


async function renderIncidents(target, approved) {
  if (!approved) {
    target.innerHTML = '<section class="dashboard-panel"><h2>Incidenty</h2><p>Tato funkce bude dostupná po schválení členství.</p></section>';
    return;
  }

  target.innerHTML = '<section class="dashboard-panel"><div class="loading-state">Načítám incidenty…</div></section>';

  try {
    const incidents = await api('/api/incidents/me');
    target.innerHTML = `
      <section class="dashboard-panel">
        <h2>Nahlásit incident</h2>
        <form id="dashboardIncidentForm" class="form">
          <div class="form-row">
            <label>Datum incidentu<input name="incidentDate" type="date" required></label>
            <label>Závažnost
              <select name="urgency">
                <option value="NORMAL">Běžná</option>
                <option value="HIGH">Vysoká</option>
                <option value="CRITICAL">Kritická</option>
              </select>
            </label>
          </div>
          <label>Utkání / událost<input name="matchInfo" required placeholder="Domácí – Hosté, kategorie"></label>
          <div class="form-row">
            <label>Soutěž<input name="competition"></label>
            <label>Místo<input name="location"></label>
          </div>
          <label>Typ incidentu
            <select name="incidentType" required>
              <option value="VERBAL_ATTACK">Slovní napadení</option>
              <option value="PHYSICAL_ATTACK">Fyzické napadení</option>
              <option value="THREAT">Výhrůžka</option>
              <option value="PRESSURE">Nátlak</option>
              <option value="DISCRIMINATION">Diskriminace</option>
              <option value="OTHER">Jiné</option>
            </select>
          </label>
          <label>Popis incidentu<textarea name="description" rows="7" required></textarea></label>
          <label>Preferovaný kontakt<input name="contactPreference" placeholder="Telefon, e-mail, čas kontaktu"></label>
          <label>Důkazy / přílohy
            <input name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt">
            <small>Max. 5 souborů, každý do 8 MB.</small>
          </label>
          <button class="primary" type="submit">Odeslat incident</button>
          <p id="incidentMessage"></p>
        </form>
      </section>

      <section class="dashboard-panel">
        <h2>Moje hlášení</h2>
        ${incidents.length ? `
          <div class="incident-history">
            ${incidents.map((incident) => `
              <article class="incident-history-item incident-history-detailed">
                <div class="incident-history-head">
                  <div>
                    <strong>${escapeHtml(incident.matchInfo)}</strong>
                    <p>${escapeHtml(incident.incidentType)} · ${new Date(incident.incidentDate).toLocaleDateString('cs-CZ')}</p>
                  </div>
                  <span class="incident-status incident-status-${String(incident.status).toLowerCase()}">${escapeHtml(incident.status)}</span>
                </div>
                <p>${escapeHtml(incident.description)}</p>
                ${renderAttachments(incident.attachments)}
                ${incident.adminNote ? `<div class="incident-admin-response"><strong>Odpověď UČFR</strong><p>${escapeHtml(incident.adminNote)}</p></div>` : ''}
                ${incident.events?.length ? `
                  <details class="incident-timeline">
                    <summary>Historie zpracování (${incident.events.length})</summary>
                    <div class="incident-timeline-list">
                      ${incident.events.map((event) => `
                        <div class="incident-timeline-item">
                          <span>${new Date(event.createdAt).toLocaleString('cs-CZ')}</span>
                          <strong>${escapeHtml(event.type)}</strong>
                          ${event.oldStatus || event.newStatus ? `<small>${escapeHtml(event.oldStatus || '—')} → ${escapeHtml(event.newStatus || '—')}</small>` : ''}
                          ${event.message ? `<p>${escapeHtml(event.message)}</p>` : ''}
                        </div>
                      `).join('')}
                    </div>
                  </details>
                ` : ''}
              </article>
            `).join('')}
          </div>
        ` : '<p>Zatím jste nenahlásili žádný incident.</p>'}
      </section>
    `;

    document.querySelector('#dashboardIncidentForm').onsubmit = submitDashboardIncident;
  } catch (error) {
    target.innerHTML = `<section class="dashboard-panel"><h2>Incidenty nelze načíst</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

async function submitDashboardIncident(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const message = document.querySelector('#incidentMessage');
  message.textContent = 'Odesílám…';

  try {
    const attachments = await collectAttachments(event.currentTarget.querySelector('input[name="attachments"]'));
    await api('/api/incidents', {
      method: 'POST',
      body: JSON.stringify({
        incidentDate: data.get('incidentDate'),
        matchInfo: data.get('matchInfo'),
        competition: data.get('competition'),
        location: data.get('location'),
        incidentType: data.get('incidentType'),
        description: data.get('description'),
        urgency: data.get('urgency'),
        contactPreference: data.get('contactPreference'),
        attachments
      })
    });
    message.textContent = 'Incident byl bezpečně uložen.';
    setTimeout(() => renderView('incidents', true), 500);
  } catch (error) {
    message.textContent = error.message;
  }
}


async function loadMembershipFees(target, approved) {
  if (!approved) {
    target.innerHTML = '<section class="dashboard-panel"><h2>Členské příspěvky</h2><p>Tato sekce bude dostupná po schválení členství.</p></section>';
    return;
  }

  target.innerHTML = '<section class="dashboard-panel"><div class="loading-state">Načítám členské příspěvky…</div></section>';
  try {
    const fees = await api('/api/fees/me');
    const statusLabel = {
      PENDING: 'Čeká na úhradu',
      PAID: 'Zaplaceno',
      OVERDUE: 'Po splatnosti',
      WAIVED: 'Prominuto',
    };

    target.innerHTML = `
      <section class="dashboard-panel">
        <div class="fees-head"><div><small>ČLENSTVÍ</small><h2>Členské příspěvky</h2></div></div>
        ${fees.length ? `
          <div class="fee-list">
            ${fees.map((fee) => `
              <article class="fee-card fee-${String(fee.status).toLowerCase()}">
                <div>
                  <small>Rok</small>
                  <h3>${fee.year}</h3>
                  <p>Splatnost: ${new Date(fee.dueDate).toLocaleDateString('cs-CZ')}</p>
                  ${fee.note ? `<p>${escapeHtml(fee.note)}</p>` : ''}
                </div>
                <div class="fee-amount">
                  <strong>${Number(fee.amountCzk).toLocaleString('cs-CZ')} Kč</strong>
                  <span>${statusLabel[fee.status] || escapeHtml(fee.status)}</span>
                  ${fee.paidAt ? `<small>Uhrazeno ${new Date(fee.paidAt).toLocaleDateString('cs-CZ')}</small>` : ''}
                </div>
              </article>
            `).join('')}
          </div>
        ` : '<p>Zatím nemáte evidovaný žádný členský příspěvek.</p>'}
      </section>
    `;
  } catch (error) {
    target.innerHTML = `<section class="dashboard-panel"><h2>Příspěvky nelze načíst</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}



async function loadDocuments(target, approved) {
  target.innerHTML = `<section class="dashboard-panel"><h2>Členské dokumenty</h2><p>Načítám dokumenty…</p></section>`;

  try {
    const documents = await api('/api/documents');

    target.innerHTML = `
      <section class="dashboard-panel">
        <h2>Členské dokumenty</h2>
        <p>${approved ? 'Dokumenty dostupné pro váš účet.' : 'Některé dokumenty budou dostupné až po schválení členství.'}</p>

        <div class="document-list">
          ${documents.length ? documents.map((document) => `
            <article class="document-card">
              <div>
                <span class="section-label">${escapeHtml(document.category || 'DOCUMENT')}</span>
                <h3>${escapeHtml(document.titleCs || document.titleEn)}</h3>
                <p>${escapeHtml(document.descriptionCs || document.descriptionEn || '')}</p>
                <small>${escapeHtml(document.visibility)} · ${new Date(document.createdAt).toLocaleDateString('cs-CZ')}</small>
              </div>
              <a class="secondary dark" href="${escapeHtml(document.url)}" target="_blank" rel="noopener">Otevřít</a>
            </article>
          `).join('') : `
            <div class="empty-results">
              <h3>Žádné dokumenty</h3>
              <p>Zatím nejsou publikované žádné dokumenty pro váš účet.</p>
            </div>
          `}
        </div>
      </section>
    `;
  } catch (error) {
    target.innerHTML = `<section class="dashboard-panel"><h2>Členské dokumenty</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

async function loadLegalRequests(target, approved) {
  if (!approved) {
    target.innerHTML = '<section class="dashboard-panel"><h2>Právní podpora</h2><p>Tato sekce bude dostupná po schválení členství.</p></section>';
    return;
  }

  target.innerHTML = '<section class="dashboard-panel"><div class="loading-state">Načítám právní dotazy…</div></section>';

  try {
    const requests = await api('/api/legal-requests/me');
    target.innerHTML = `
      <section class="dashboard-panel">
        <small>PRÁVNÍ PODPORA</small>
        <h2>Nový právní dotaz</h2>
        <p>Popište problém související s výkonem funkce rozhodčího.</p>
        <form id="legalRequestForm" class="form">
          <label>Předmět<input name="subject" required></label>
          <div class="form-row">
            <label>Oblast
              <select name="category" required>
                <option value="DISCIPLINARY">Disciplinární řízení</option>
                <option value="CONTRACT">Smlouvy a odměny</option>
                <option value="SAFETY">Bezpečnost a napadení</option>
                <option value="DATA_PROTECTION">Ochrana osobních údajů</option>
                <option value="OTHER">Jiné</option>
              </select>
            </label>
            <label>Naléhavost
              <select name="urgency">
                <option value="NORMAL">Běžná</option>
                <option value="HIGH">Vysoká</option>
                <option value="URGENT">Naléhavá</option>
              </select>
            </label>
          </div>
          <label>Popis situace<textarea name="description" rows="8" required></textarea></label>
          <label>Přílohy k dotazu
            <input name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt">
            <small>Max. 5 souborů, každý do 8 MB.</small>
          </label>
          <button class="primary" type="submit">Odeslat dotaz</button>
          <p id="legalRequestMessage"></p>
        </form>
      </section>

      <section class="dashboard-panel">
        <h2>Moje právní dotazy</h2>
        ${requests.length ? `
          <div class="legal-request-list">
            ${requests.map((item) => `
              <article class="legal-request-card legal-${String(item.status).toLowerCase()}">
                <div class="incident-history-head">
                  <div>
                    <strong>${escapeHtml(item.subject)}</strong>
                    <p>${escapeHtml(item.category)} · ${new Date(item.createdAt).toLocaleString('cs-CZ')}</p>
                  </div>
                  <span class="incident-status">${escapeHtml(item.status)}</span>
                </div>
                <p>${escapeHtml(item.description)}</p>
                <small>Naléhavost: ${escapeHtml(item.urgency)}</small>
                ${renderAttachments(item.attachments)}
                ${item.adminReply ? `<div class="incident-admin-response"><strong>Odpověď UČFR</strong><p>${escapeHtml(item.adminReply)}</p></div>` : ''}
              </article>
            `).join('')}
          </div>
        ` : '<p>Zatím jste neposlali žádný právní dotaz.</p>'}
      </section>
    `;

    document.querySelector('#legalRequestForm').onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const message = document.querySelector('#legalRequestMessage');
      message.textContent = 'Odesílám…';
      try {
        const payload = Object.fromEntries(data.entries());
        payload.attachments = await collectAttachments(event.currentTarget.querySelector('input[name="attachments"]'));
        await api('/api/legal-requests', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        message.textContent = 'Dotaz byl bezpečně uložen.';
        setTimeout(() => renderView('legal', true), 500);
      } catch (error) {
        message.textContent = error.message;
      }
    };
  } catch (error) {
    target.innerHTML = `<section class="dashboard-panel"><h2>Právní dotazy nelze načíst</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

init();
