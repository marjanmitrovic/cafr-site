(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001'
      : window.location.origin);

  const REGIONS = [
    'Hlavní město Praha',
    'Středočeský kraj',
    'Jihočeský kraj',
    'Plzeňský kraj',
    'Karlovarský kraj',
    'Ústecký kraj',
    'Liberecký kraj',
    'Královéhradecký kraj',
    'Pardubický kraj',
    'Kraj Vysočina',
    'Jihomoravský kraj',
    'Olomoucký kraj',
    'Zlínský kraj',
    'Moravskoslezský kraj',
  ];

  const REFEREE_ROLES = [
    'Aktivní rozhodčí',
    'Asistent rozhodčího',
    'Videorozhodčí',
    'Bývalý rozhodčí',
    'Delegát',
    'Pozorovatel rozhodčích',
  ];

  const REFEREE_LISTS = [
    'Profesionální soutěže',
    'Divize / ČFL / MSFL',
    'Krajské soutěže',
    'Okresní soutěže',
    'Bývalý rozhodčí / Ostatní',
  ];

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
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  function optionList(values, placeholder) {
    return [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
    ].join('');
  }

  function parseRefereeStatus(value) {
    const raw = String(value || '').trim();
    const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
    const facrPart = parts.find((part) => /^(?:ID\s*)?FAČR\s*:/i.test(part));
    const listPart = parts.find((part) => /^(?:Listina|Soutěž|Referee list)\s*:/i.test(part));
    const roleParts = parts.filter((part) => part !== facrPart && part !== listPart);

    return {
      role: roleParts.join(' | ') || (!facrPart && !listPart ? raw : ''),
      facrId: facrPart ? facrPart.replace(/^(?:ID\s*)?FAČR\s*:\s*/i, '') : '',
      refereeList: listPart ? listPart.replace(/^(?:Listina|Soutěž|Referee list)\s*:\s*/i, '') : '',
    };
  }

  function setSelectValue(select, value) {
    const normalized = String(value || '').trim();
    if (normalized && ![...select.options].some((option) => option.value === normalized)) {
      select.add(new Option(normalized, normalized));
    }
    select.value = normalized;
  }

  function ensureEditor() {
    let backdrop = document.getElementById('adminPrimaryMemberEditor');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'adminPrimaryMemberEditor';
    backdrop.className = 'admin-primary-editor-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="admin-primary-editor" role="dialog" aria-modal="true" aria-labelledby="adminPrimaryEditorTitle">
        <button class="admin-primary-editor-close" type="button" data-primary-editor-close aria-label="Zavřít">×</button>
        <span class="section-label">KONTROLA PŘIHLÁŠKY</span>
        <h3 id="adminPrimaryEditorTitle">Upravit údaje před schválením</h3>
        <p>Opravte údaje kandidáta před potvrzením členství.</p>

        <form id="adminPrimaryEditorForm" class="admin-primary-editor-form">
          <input type="hidden" name="memberId">
          <div class="admin-primary-editor-grid">
            <label>Jméno<input name="firstName" required></label>
            <label>Příjmení<input name="lastName" required></label>
            <label>E-mail<input name="email" type="email" required></label>
            <label>Telefon<input name="phone" required></label>
            <label>Kraj / okres<select name="region" required>${optionList(REGIONS, 'Vyberte kraj')}</select></label>
            <label>Status rozhodčího<select name="refereeRole" required>${optionList(REFEREE_ROLES, 'Vyberte status')}</select></label>
            <label>ID FAČR<input name="facrId" inputmode="numeric" pattern="[0-9]+" required></label>
            <label>Listina rozhodčích<select name="refereeList" required>${optionList(REFEREE_LISTS, 'Vyberte listinu')}</select></label>
          </div>
          <p id="adminPrimaryEditorMessage" class="admin-primary-editor-message" aria-live="polite"></p>
          <div class="admin-primary-editor-actions">
            <button class="admin-primary-editor-cancel" type="button" data-primary-editor-close>Zrušit</button>
            <button class="admin-primary-editor-save" type="submit">Uložit změny</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(backdrop);

    const close = () => {
      backdrop.hidden = true;
      document.documentElement.classList.remove('admin-primary-editor-open');
    };

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('[data-primary-editor-close]')) close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !backdrop.hidden) close();
    });

    backdrop.querySelector('form').addEventListener('input', (event) => {
      event.target.setCustomValidity?.('');
    });

    backdrop.querySelector('form').addEventListener('submit', saveMember);
    return backdrop;
  }

  async function fetchMember(memberId) {
    const token = adminToken();
    if (!token) throw new Error('Chybí administrátorské přihlášení. Přihlaste se znovu.');

    const response = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Údaje kandidáta nelze načíst.');

    const member = Array.isArray(data) ? data.find((item) => item.id === memberId) : null;
    if (!member) throw new Error('Kandidát nebyl nalezen.');
    return member;
  }

  function showEditor(member, sourceCard) {
    const backdrop = ensureEditor();
    const form = backdrop.querySelector('form');
    const referee = parseRefereeStatus(member.refereeStatus);

    form.elements.memberId.value = member.id;
    form.elements.firstName.value = member.firstName || '';
    form.elements.lastName.value = member.lastName || '';
    form.elements.email.value = member.email || '';
    form.elements.phone.value = member.phone || '';
    setSelectValue(form.elements.region, member.region || '');
    setSelectValue(form.elements.refereeRole, referee.role || '');
    form.elements.facrId.value = referee.facrId || '';
    setSelectValue(form.elements.refereeList, referee.refereeList || '');
    form.dataset.sourceMemberId = member.id;

    const message = backdrop.querySelector('#adminPrimaryEditorMessage');
    message.textContent = '';
    message.className = 'admin-primary-editor-message';

    backdrop.querySelector('#adminPrimaryEditorTitle').textContent =
      `Upravit přihlášku: ${member.firstName || ''} ${member.lastName || ''}`.trim();
    backdrop.dataset.sourceCardId = member.id;
    backdrop._sourceCard = sourceCard;
    backdrop.hidden = false;
    document.documentElement.classList.add('admin-primary-editor-open');
    window.setTimeout(() => form.elements.firstName.focus(), 30);
  }

  async function openEditor(memberId, sourceCard, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Načítám…';

    try {
      const member = await fetchMember(memberId);
      if (member.membershipStatus !== 'PENDING') {
        throw new Error('Tuto přihlášku již nelze před schválením upravit.');
      }
      showEditor(member, sourceCard);
    } catch (error) {
      window.alert(error.message);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function updateVisibleCard(card, member) {
    if (!card) return;
    const heading = card.querySelector('.admin-member-main h4');
    const email = card.querySelector('.admin-member-main h4 + p');
    const meta = card.querySelectorAll('.admin-member-meta span');

    if (heading) heading.textContent = `${member.firstName} ${member.lastName}`;
    if (email) email.textContent = member.email;
    if (meta[0]) meta[0].textContent = member.region;
    if (meta[1]) meta[1].textContent = member.refereeStatus;
  }

  async function saveMember(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const backdrop = form.closest('.admin-primary-editor-backdrop');
    const message = form.querySelector('#adminPrimaryEditorMessage');
    const saveButton = form.querySelector('.admin-primary-editor-save');

    if (!form.checkValidity()) {
      message.textContent = 'Vyplňte prosím všechna povinná pole.';
      message.className = 'admin-primary-editor-message error';
      form.reportValidity();
      return;
    }

    const facrId = String(form.elements.facrId.value || '').trim();
    if (!/^\d+$/.test(facrId)) {
      form.elements.facrId.setCustomValidity('ID FAČR může obsahovat pouze číslice.');
      form.elements.facrId.reportValidity();
      form.elements.facrId.focus();
      return;
    }

    const payload = {
      firstName: String(form.elements.firstName.value || '').trim(),
      lastName: String(form.elements.lastName.value || '').trim(),
      email: String(form.elements.email.value || '').trim(),
      phone: String(form.elements.phone.value || '').trim(),
      region: String(form.elements.region.value || '').trim(),
      refereeStatus: [
        String(form.elements.refereeRole.value || '').trim(),
        `ID FAČR: ${facrId}`,
        `Listina: ${String(form.elements.refereeList.value || '').trim()}`,
      ].join(' | '),
    };

    saveButton.disabled = true;
    saveButton.textContent = 'Ukládám…';
    message.textContent = '';

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/users/${encodeURIComponent(form.elements.memberId.value)}/profile`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken()}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Údaje se nepodařilo uložit.');

      updateVisibleCard(backdrop._sourceCard, data.user);
      message.textContent = 'Údaje byly uloženy. Nyní můžete člena schválit.';
      message.className = 'admin-primary-editor-message success';
      window.setTimeout(() => {
        backdrop.hidden = true;
        document.documentElement.classList.remove('admin-primary-editor-open');
      }, 900);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'admin-primary-editor-message error';
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Uložit změny';
    }
  }

  function enhanceCard(card) {
    if (!card || card.dataset.primaryEditEnhanced === 'true') return;

    const statusSelect = card.querySelector('select[data-user-status]');
    const controls = card.querySelector('.admin-member-controls');
    if (!statusSelect || !controls) return;

    card.dataset.primaryEditEnhanced = 'true';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-primary-member-edit';
    button.textContent = 'Upravit údaje před schválením';
    button.dataset.primaryEditMember = statusSelect.dataset.userStatus;
    controls.appendChild(button);

    const syncVisibility = () => {
      button.hidden = statusSelect.value !== 'PENDING';
    };

    statusSelect.addEventListener('change', () => window.setTimeout(syncVisibility, 0));
    button.addEventListener('click', () => openEditor(button.dataset.primaryEditMember, card, button));
    syncVisibility();
  }

  function scan(root = document) {
    if (root.matches?.('.admin-member-card')) enhanceCard(root);
    root.querySelectorAll?.('.admin-member-card').forEach(enhanceCard);
  }

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
