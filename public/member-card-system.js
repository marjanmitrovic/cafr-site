(() => {
  'use strict';

  const CARD_WIDTH = 1011;
  const CARD_HEIGHT = 638;
  const TEMPLATE_URL = '/cards/card-template.svg';
  const LOGO_URL = '/assets/ucfr-logo.png?v=5';
  const QR_ENDPOINT = 'https://api.qrserver.com/v1/create-qr-code/';
  const DIRECTORY_SELECTOR = '.admin-directory-table';

  let templatePromise = null;
  let logoPromise = null;
  let adminUsersPromise = null;
  let adminEnhanceTimer = null;

  function apiBase() {
    return localStorage.getItem('cafr-api-base') || (
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : window.location.origin
    );
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem('cafr-user') || 'null');
    } catch {
      return null;
    }
  }

  function adminToken() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function escapeXml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    })[character]);
  }

  function cardNumber(member) {
    if (member?.cardNumber) return String(member.cardNumber);
    const suffix = String(member?.id || '').slice(-8).toUpperCase();
    return `UCFR-${suffix || 'NEVYDANO'}`;
  }

  function verificationUrl(member) {
    return `${window.location.origin}/verify.html?member=${encodeURIComponent(member.id)}`;
  }

  function statusInfo(member) {
    const status = String(member?.membershipStatus || 'PENDING').toUpperCase();
    const map = {
      APPROVED: { label: 'PLATNÝ ČLEN', color: '#15803d' },
      PENDING: { label: 'ČEKÁ NA SCHVÁLENÍ', color: '#b7791f' },
      SUSPENDED: { label: 'POZASTAVENO', color: '#c2410c' },
      REJECTED: { label: 'NEPLATNÝ PRŮKAZ', color: '#b42318' },
    };
    return map[status] || { label: 'NEPLATNÝ PRŮKAZ', color: '#b42318' };
  }

  function issuedLabel(member) {
    const value = member?.approvedAt || member?.createdAt;
    if (!value) return 'VYDÁNO —';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'VYDÁNO —';
    return `VYDÁNO ${date.toLocaleDateString('cs-CZ')}`;
  }

  function safeFileName(value) {
    return String(value || 'cafr-card')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'cafr-card';
  }

  function memberFileStem(member) {
    return safeFileName(`${cardNumber(member)}-${member.firstName || ''}-${member.lastName || ''}`);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Soubor nelze převést do datového formátu.'));
      reader.readAsDataURL(blob);
    });
  }

  async function fetchDataUrl(url) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Soubor nelze načíst (${response.status}).`);
    return blobToDataUrl(await response.blob());
  }

  function loadTemplate() {
    if (!templatePromise) {
      templatePromise = fetch(TEMPLATE_URL, { cache: 'no-cache' }).then(async (response) => {
        if (!response.ok) throw new Error('SVG šablona průkazu nebyla nalezena.');
        return response.text();
      });
    }
    return templatePromise;
  }

  function loadLogo() {
    if (!logoPromise) logoPromise = fetchDataUrl(LOGO_URL);
    return logoPromise;
  }

  async function loadQr(member) {
    const url = `${QR_ENDPOINT}?size=420x420&margin=0&format=png&data=${encodeURIComponent(verificationUrl(member))}`;
    try {
      return await fetchDataUrl(url);
    } catch (error) {
      throw new Error(`QR kód nelze vytvořit. ${error.message}`);
    }
  }

  function nameFontSize(name) {
    const length = String(name || '').length;
    if (length > 29) return 31;
    if (length > 24) return 34;
    if (length > 19) return 38;
    return 42;
  }

  async function renderCardSvg(member) {
    if (!member?.id) throw new Error('Chybí identifikátor člena.');

    const [template, logo, qr] = await Promise.all([
      loadTemplate(),
      loadLogo(),
      loadQr(member),
    ]);

    const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toUpperCase() || 'NEUVEDENO';
    const status = statusInfo(member);
    const replacements = {
      '{{LOGO}}': logo,
      '{{QR}}': qr,
      '{{NAME}}': escapeXml(fullName),
      '{{NAME_FONT_SIZE}}': String(nameFontSize(fullName)),
      '{{CARD_NUMBER}}': escapeXml(cardNumber(member)),
      '{{STATUS}}': escapeXml(status.label),
      '{{STATUS_COLOR}}': status.color,
      '{{ISSUED}}': escapeXml(issuedLabel(member)),
    };

    return Object.entries(replacements).reduce(
      (svg, [placeholder, value]) => svg.split(placeholder).join(value),
      template,
    );
  }

  function imageFromObjectUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Náhled průkazu nelze vykreslit.'));
      image.src = url;
    });
  }

  async function svgToCanvas(svg) {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await imageFromObjectUrl(url);
      const canvas = document.createElement('canvas');
      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Prohlížeč nepodporuje export průkazu.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
      context.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Exportní soubor nelze vytvořit.'));
      }, type, quality);
    });
  }

  async function createPngBlob(svg) {
    return canvasToBlob(await svgToCanvas(svg), 'image/png');
  }

  async function createJpegBlob(svg) {
    return canvasToBlob(await svgToCanvas(svg), 'image/jpeg', 0.98);
  }

  function encoded(text) {
    return new TextEncoder().encode(text);
  }

  function bytesLength(parts) {
    return parts.reduce((sum, part) => sum + (typeof part === 'string' ? encoded(part).length : part.length), 0);
  }

  function appendPdfObject(parts, offsets, objectNumber, objectParts) {
    offsets[objectNumber] = bytesLength(parts);
    parts.push(`${objectNumber} 0 obj\n`);
    parts.push(...objectParts);
    parts.push('\nendobj\n');
  }

  async function createPdfBlob(svg) {
    const jpegBlob = await createJpegBlob(svg);
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const widthPt = 85.6 * 72 / 25.4;
    const heightPt = 53.98 * 72 / 25.4;
    const content = `q\n${widthPt.toFixed(4)} 0 0 ${heightPt.toFixed(4)} 0 0 cm\n/Im0 Do\nQ\n`;
    const parts = ['%PDF-1.4\n%CAFRCARD\n'];
    const offsets = [0];

    appendPdfObject(parts, offsets, 1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    appendPdfObject(parts, offsets, 2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
    appendPdfObject(parts, offsets, 3, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(4)} ${heightPt.toFixed(4)}] `,
      '/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
    ]);
    appendPdfObject(parts, offsets, 4, [
      `<< /Length ${encoded(content).length} >>\nstream\n${content}endstream`,
    ]);
    appendPdfObject(parts, offsets, 5, [
      `<< /Type /XObject /Subtype /Image /Width ${CARD_WIDTH} /Height ${CARD_HEIGHT} `,
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
      jpegBytes,
      '\nendstream',
    ]);

    const xrefOffset = bytesLength(parts);
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let index = 1; index <= 5; index += 1) {
      xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    parts.push(xref);

    return new Blob(parts, { type: 'application/pdf' });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function printSvg(svg) {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1050,height=760');
    if (!printWindow) throw new Error('Prohlížeč zablokoval tiskové okno.');
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="cs"><head><meta charset="utf-8"><title>UČFR členský průkaz</title>
      <style>
        @page { size: 85.6mm 53.98mm; margin: 0; }
        html, body { width: 85.6mm; height: 53.98mm; margin: 0; padding: 0; overflow: hidden; background: #fff; }
        svg { display: block; width: 85.6mm; height: 53.98mm; }
      </style></head><body>${svg}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    printWindow.document.close();
  }

  function setMessage(container, message, isError = false) {
    const element = container.querySelector('.cafr-card-message');
    if (!element) return;
    element.textContent = message || '';
    element.style.color = isError ? '#b42318' : '#0b4ea2';
  }

  function setBusy(container, busy) {
    container.querySelectorAll('[data-card-action]').forEach((element) => {
      if (element.tagName === 'BUTTON') element.disabled = busy;
    });
  }

  function createWorkbench(member, options = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cafr-card-workbench';
    wrapper.innerHTML = `
      ${options.showTitle === false ? '' : `<div><h2>${options.admin ? 'Členský průkaz člena' : 'Můj členský průkaz'}</h2><p>${escapeXml(member.firstName || '')} ${escapeXml(member.lastName || '')} · ${escapeXml(cardNumber(member))}</p></div>`}
      <div class="cafr-card-preview-shell"><div class="cafr-card-loading">Generuji bezpečný náhled průkazu…</div></div>
      <div class="cafr-card-actions">
        <button class="primary-card-action" type="button" data-card-action="png">Stáhnout PNG</button>
        <button type="button" data-card-action="pdf">Stáhnout PDF</button>
        <button type="button" data-card-action="svg">Stáhnout SVG</button>
        <button type="button" data-card-action="print">Tisk</button>
        <a data-card-action="verify" href="${verificationUrl(member)}" target="_blank" rel="noopener">Ověřit průkaz</a>
      </div>
      <p class="cafr-card-note">CR80 · 85,60 × 53,98 mm · export 1011 × 638 px</p>
      <p class="cafr-card-message" aria-live="polite"></p>
    `;

    let svg = null;
    setBusy(wrapper, true);

    renderCardSvg(member).then((result) => {
      svg = result;
      const preview = wrapper.querySelector('.cafr-card-preview-shell');
      preview.innerHTML = svg;
      setBusy(wrapper, false);
    }).catch((error) => {
      wrapper.querySelector('.cafr-card-preview-shell').innerHTML = `<div class="cafr-card-loading">${escapeXml(error.message)}</div>`;
      setMessage(wrapper, error.message, true);
    });

    wrapper.addEventListener('click', async (event) => {
      const actionElement = event.target.closest('[data-card-action]');
      if (!actionElement || actionElement.tagName === 'A') return;
      const action = actionElement.dataset.cardAction;
      if (!svg) return;

      try {
        setBusy(wrapper, true);
        setMessage(wrapper, 'Připravuji soubor…');
        const stem = memberFileStem(member);
        if (action === 'png') downloadBlob(await createPngBlob(svg), `${stem}.png`);
        if (action === 'pdf') downloadBlob(await createPdfBlob(svg), `${stem}.pdf`);
        if (action === 'svg') downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${stem}.svg`);
        if (action === 'print') printSvg(svg);
        setMessage(wrapper, action === 'print' ? 'Tiskové okno bylo otevřeno.' : 'Soubor byl vytvořen.');
      } catch (error) {
        setMessage(wrapper, error.message || 'Export se nezdařil.', true);
      } finally {
        setBusy(wrapper, false);
      }
    });

    return wrapper;
  }

  function enhanceMemberDashboard() {
    const panel = document.querySelector('.digital-card-panel');
    if (!panel || panel.dataset.cafrCardEnhanced === 'true') return;
    const member = currentUser();
    if (!member?.id) return;
    panel.dataset.cafrCardEnhanced = 'true';
    panel.innerHTML = '';
    panel.appendChild(createWorkbench(member, { showTitle: true, admin: false }));
  }

  async function fetchAdminUsers() {
    if (!adminUsersPromise) {
      const token = adminToken();
      if (!token) throw new Error('Admin token missing');
      adminUsersPromise = fetch(`${apiBase()}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Členy nelze načíst.');
        return Array.isArray(data) ? data : [];
      }).catch((error) => {
        adminUsersPromise = null;
        throw error;
      });
    }
    return adminUsersPromise;
  }

  function ensureAdminModal() {
    let modal = document.querySelector('#cafrMemberCardModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'cafrMemberCardModal';
    modal.className = 'cafr-card-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="cafr-card-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="cafrMemberCardModalTitle">
        <div class="cafr-card-modal-head">
          <h2 id="cafrMemberCardModalTitle">Členský průkaz</h2>
          <button class="cafr-card-modal-close" type="button" aria-label="Zavřít">×</button>
        </div>
        <div class="cafr-card-modal-body"></div>
      </div>
    `;
    const close = () => {
      modal.hidden = true;
      modal.querySelector('.cafr-card-modal-body').innerHTML = '';
      document.body.style.overflow = '';
    };
    modal.querySelector('.cafr-card-modal-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) close();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function openAdminCard(member) {
    const modal = ensureAdminModal();
    modal.querySelector('#cafrMemberCardModalTitle').textContent = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Členský průkaz';
    const body = modal.querySelector('.cafr-card-modal-body');
    body.innerHTML = '';
    body.appendChild(createWorkbench(member, { showTitle: false, admin: true }));
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  async function enhanceAdminDirectory() {
    const table = document.querySelector(DIRECTORY_SELECTOR);
    if (!table) return;
    const stored = currentUser();
    if (!stored || !['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(stored.role)) return;

    const headerRow = table.querySelector('thead tr');
    if (headerRow && !headerRow.querySelector('[data-cafr-card-header]')) {
      const header = document.createElement('th');
      header.dataset.cafrCardHeader = 'true';
      header.textContent = 'Průkaz';
      headerRow.appendChild(header);
    }

    let users;
    try {
      users = await fetchAdminUsers();
    } catch {
      return;
    }
    const byEmail = new Map(users.map((member) => [String(member.email || '').trim().toLowerCase(), member]));

    table.querySelectorAll('tbody tr').forEach((row) => {
      if (row.dataset.cafrCardRow === 'true') return;
      const cells = row.querySelectorAll('td');
      if (cells.length < 3 || cells[0].hasAttribute('colspan')) return;
      const email = String(cells[2].textContent || '').trim().toLowerCase();
      const member = byEmail.get(email);
      if (!member) return;

      row.dataset.cafrCardRow = 'true';
      const cell = document.createElement('td');
      cell.className = 'cafr-admin-card-cell';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-card-button';
      button.textContent = 'Průkaz';
      button.addEventListener('click', () => openAdminCard(member));
      cell.appendChild(button);
      row.appendChild(cell);
    });
  }

  function scheduleAdminEnhancement() {
    window.clearTimeout(adminEnhanceTimer);
    adminEnhanceTimer = window.setTimeout(() => {
      enhanceAdminDirectory().catch(() => {});
    }, 80);
  }

  const observer = new MutationObserver(() => {
    enhanceMemberDashboard();
    scheduleAdminEnhancement();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceMemberDashboard();
  scheduleAdminEnhancement();

  window.CAFRMemberCards = Object.freeze({
    cardNumber,
    verificationUrl,
    renderCardSvg,
    createPngBlob,
    createPdfBlob,
    printSvg,
    openAdminCard,
  });
})();
