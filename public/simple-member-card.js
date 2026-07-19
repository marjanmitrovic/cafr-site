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

  function safeFileName(value) {
    return String(value || 'cafr-prukaz')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || 'cafr-prukaz';
  }

  function fileStem(member) {
    return safeFileName(
      `${cardNumber(member)}-${member?.firstName || ''}-${member?.lastName || ''}`
    );
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function renderActions() {
    return `
      <div class="cafr-card-export-actions" aria-label="Stažení a tisk členského průkazu">
        <button type="button" class="cafr-card-export-primary" data-simple-card-action="png">Stáhnout PNG</button>
        <button type="button" data-simple-card-action="pdf">Stáhnout PDF</button>
        <button type="button" data-simple-card-action="svg">Stáhnout SVG</button>
        <button type="button" data-simple-card-action="print">Tisk 85,60 × 53,98 mm</button>
      </div>
      <p class="cafr-card-export-message" aria-live="polite"></p>
    `;
  }

  function renderCard(member, options = {}) {
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
      ${options.showActions ? renderActions() : ''}
      <p class="cafr-card-phone-note">Po naskenování QR kódu se tento průkaz zobrazí na telefonu společně s ověřením členství.</p>
    `;
  }

  function setExportBusy(container, busy) {
    container.querySelectorAll('[data-simple-card-action]').forEach((button) => {
      button.disabled = busy;
    });
  }

  function setExportMessage(container, text, isError = false) {
    const message = container.querySelector('.cafr-card-export-message');
    if (!message) return;
    message.textContent = text || '';
    message.classList.toggle('is-error', Boolean(isError));
  }

  async function getCardEngine() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (window.CAFRMemberCards?.renderCardSvg) return window.CAFRMemberCards;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    throw new Error('Export průkazu není momentálně dostupný. Obnovte stránku.');
  }

  function bindExportActions(container, member) {
    container.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-simple-card-action]');
      if (!button || !container.contains(button)) return;

      const action = button.dataset.simpleCardAction;
      setExportBusy(container, true);
      setExportMessage(container, action === 'print' ? 'Připravuji tisk…' : 'Připravuji soubor…');

      try {
        const engine = await getCardEngine();
        const svg = await engine.renderCardSvg(member);
        const stem = fileStem(member);

        if (action === 'png') {
          downloadBlob(await engine.createPngBlob(svg), `${stem}.png`);
        } else if (action === 'pdf') {
          downloadBlob(await engine.createPdfBlob(svg), `${stem}.pdf`);
        } else if (action === 'svg') {
          downloadBlob(
            new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
            `${stem}.svg`
          );
        } else if (action === 'print') {
          engine.printSvg(svg);
        }

        setExportMessage(
          container,
          action === 'print'
            ? 'Tiskové okno bylo otevřeno v přesném formátu 85,60 × 53,98 mm.'
            : 'Soubor byl vytvořen.'
        );
      } catch (error) {
        setExportMessage(container, error.message || 'Export průkazu se nezdařil.', true);
      } finally {
        setExportBusy(container, false);
      }
    });
  }

  function enhanceProfileCard() {
    const oldCard = document.querySelector('.profile-member-card');
    if (!oldCard || oldCard.dataset.definedCard === 'true') return;

    const member = storedUser();
    if (!member?.id) return;

    const isAdministrator = ['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(String(member.role || '').toUpperCase());
    oldCard.className = `cafr-defined-card-host${isAdministrator ? ' cafr-defined-card-host-admin' : ''}`;
    oldCard.dataset.definedCard = 'true';
    oldCard.innerHTML = renderCard(member, { showActions: true });
    bindExportActions(oldCard, member);
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
