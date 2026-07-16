import './style.css';

const API_BASE = localStorage.getItem('cafr-api-base') || 'http://localhost:3001';
const app = document.querySelector('#verifyApp');
const params = new URLSearchParams(window.location.search);
const memberId = params.get('member');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function shell(content) {
  app.innerHTML = `
    <main class="verify-page">
      <a class="verify-brand" href="/">
        <img src="/assets/cafr-logo.png" alt="ČAFR">
        <span>Česká asociace fotbalových rozhodčích</span>
      </a>
      ${content}
      <a class="secondary dark verify-home" href="/">Zpět na hlavní stránku</a>
    </main>
  `;
}

async function verify() {
  if (!memberId) {
    shell(`<section class="verify-card invalid"><div class="verify-symbol">✕</div><h1>Neplatný ověřovací odkaz</h1><p>V odkazu chybí identifikátor člena.</p></section>`);
    return;
  }

  shell(`<section class="verify-card"><div class="loading-state">Ověřuji členský průkaz…</div></section>`);

  try {
    const response = await fetch(`${API_BASE}/api/members/verify/${encodeURIComponent(memberId)}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.member) {
      throw new Error('Členský průkaz nebyl nalezen.');
    }

    const statusLabels = {
      APPROVED: 'Platné členství',
      PENDING: 'Členství čeká na schválení',
      REJECTED: 'Přihláška byla zamítnuta',
      SUSPENDED: 'Členství je pozastaveno'
    };

    shell(`
      <section class="verify-card ${data.valid ? 'valid' : 'invalid'}">
        <div class="verify-symbol">${data.valid ? '✓' : '!'}</div>
        <span class="section-label">OVĚŘENÍ ČLENSKÉHO PRŮKAZU</span>
        <h1>${statusLabels[data.status] || 'Neplatné členství'}</h1>
        <div class="verify-details">
          <div><small>Číslo průkazu</small><strong>${escapeHtml(data.member.cardNumber || '—')}</strong></div>
          ${data.valid ? `
            <div><small>Člen</small><strong>${escapeHtml(data.member.firstName)} ${escapeHtml(data.member.lastName)}</strong></div>
            <div><small>Role</small><strong>${escapeHtml(data.member.role)}</strong></div>
            <div><small>Schváleno</small><strong>${data.member.approvedAt ? new Date(data.member.approvedAt).toLocaleDateString('cs-CZ') : '—'}</strong></div>
          ` : ''}
          <div><small>Poslední kontrola</small><strong>${new Date(data.checkedAt).toLocaleString('cs-CZ')}</strong></div>
        </div>
      </section>
    `);
  } catch (error) {
    shell(`<section class="verify-card invalid"><div class="verify-symbol">✕</div><h1>Průkaz nelze ověřit</h1><p>${escapeHtml(error.message)}</p></section>`);
  }
}

verify();
