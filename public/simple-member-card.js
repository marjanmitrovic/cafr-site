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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function storedUser() {
    try {
      return JSON.parse(localStorage.getItem('cafr-user') || 'null');
    } catch {
      return null;
    }
  }

  function cardNumber(member) {
    if (member?.cardNumber) return String(member.cardNumber);
    const suffix = String(member?.id || '').slice(-8).toUpperCase();
    return `CAFR-${suffix || 'NEVYDANO'}`;
  }

  function verificationUrl(member) {
    return `${window.location.origin}/verify.html?member=${encodeURIComponent(member.id)}`;
  }

  function qrUrl(member) {
    return 'https://api.qrserver.com/v1/create-qr-code/' +
      `?size=420x420&margin=0&format=png&data=${encodeURIComponent(verificationUrl(member))}`;
  }

  function issuedDate(member) {
    const value = member?.approvedAt || member?.createdAt;
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('cs-CZ');
  }

  function statusInfo(member) {
    const status = String(member?.membershipStatus || member?.status || 'PENDING').toUpperCase();
    const values = {
      APPROVED: { text: 'Platný člen', className: '' },
      ACTIVE: { text: 'Platný člen', className: '' },
      PENDING: { text: 'Čeká na schválení', className: 'is-pending' },
      SUSPENDED: { text: 'Pozastaveno', className: 'is-suspended' },
      REJECTED: { text: 'Neplatný průkaz', className: 'is-invalid' },
      REVOKED: { text: 'Neplatný průkaz', className: 'is-invalid' },
    };
    return values[status] || values.REJECTED;
  }

  function renderCard(member) {
    const fullName = `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || 'Neuvedeno';
    const status = statusInfo(member);

    return `
      <article class="cafr-id-card" aria-label="ČAFR členský průkaz">
        <div class="cafr-card-top">
          <img class="cafr-card-logo" src="/assets/cafr-logo.png" alt="ČAFR">
          <div class="cafr-card-brand">
            <strong>ČAFR</strong>
            <span>ČESKÁ ASOCIACE<br>FOTBALOVÝCH ROZHODČÍCH</span>
          </div>
        </div>

        <div class="cafr-card-tricolor" aria-hidden="true"><i></i><i></i><i></i></div>

        <div class="cafr-card-bottom">
          <h3 class="cafr-card-type">ČLENSKÝ PRŮKAZ</h3>

          <div class="cafr-card-data">
            <div class="cafr-card-field cafr-card-field-name">
              <small>JMÉNO A PŘÍJMENÍ</small>
              <strong>${escapeHtml(fullName)}</strong>
            </div>

            <div class="cafr-card-field">
              <small>ČLENSKÉ ID</small>
              <strong>${escapeHtml(cardNumber(member))}</strong>
            </div>

            <div class="cafr-card-field">
              <small>STATUS</small>
              <strong class="cafr-card-status ${status.className}">${escapeHtml(status.text)}</strong>
            </div>
          </div>

          <div class="cafr-card-qr-box">
            <img src="${qrUrl(member)}" alt="QR kód pro ověření členského průkazu">
          </div>

          <div class="cafr-card-footer">
            ČESKÁ ASOCIACE FOTBALOVÝCH ROZHODČÍCH • VYDÁNO ${escapeHtml(issuedDate(member))}
          </div>
        </div>
      </article>
      <p class="cafr-card-phone-note">Po naskenování QR kódu se tento průkaz zobrazí na telefonu společně s ověřením členství.</p>
    `;
  }

  function enhanceProfileCard() {
    const oldCard = document.querySelector('.profile-member-card');
    if (!oldCard || oldCard.dataset.definedCard === 'true') return;

    const member = storedUser();
    if (!member?.id) return;

    const isAdministrator = ['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(String(member.role || '').toUpperCase());
    oldCard.className = `cafr-defined-card-host${isAdministrator ? ' cafr-defined-card-host-admin' : ''}`;
    oldCard.dataset.definedCard = 'true';
    oldCard.innerHTML = renderCard(member);
  }

  async function enhanceVerificationPage() {
    const verifyApp = document.querySelector('#verifyApp');
    if (!verifyApp || document.querySelector('.cafr-public-card-section')) return;

    const memberId = new URLSearchParams(window.location.search).get('member');
    if (!memberId) return;

    try {
      const response = await fetch(`${API_BASE}/api/members/verify/${encodeURIComponent(memberId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.member || !data.valid) return;

      const section = document.createElement('section');
      section.className = 'cafr-public-card-section';
      section.innerHTML = renderCard({
        id: memberId,
        firstName: data.member.firstName,
        lastName: data.member.lastName,
        cardNumber: data.member.cardNumber,
        membershipStatus: data.status,
        approvedAt: data.member.approvedAt,
      });

      const existingCard = verifyApp.querySelector('.verify-card');
      if (existingCard) existingCard.before(section);
      else verifyApp.appendChild(section);
    } catch {
      // Existing verification UI remains available when card rendering cannot be loaded.
    }
  }

  let scheduled = false;
  function scheduleEnhancement() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      enhanceProfileCard();
      enhanceVerificationPage();
    });
  }

  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scheduleEnhancement();
})();
