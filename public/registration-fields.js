(() => {
  'use strict';

  const competitionOptions = {
    cs: [
      ['PROFESSIONAL', 'Profesionální soutěže'],
      ['NATIONAL', 'Divize / ČFL / MSFL'],
      ['REGIONAL', 'Krajské soutěže'],
      ['DISTRICT', 'Okresní soutěže'],
      ['FORMER_OTHER', 'Bývalý rozhodčí / Ostatní']
    ],
    en: [
      ['PROFESSIONAL', 'Professional competitions'],
      ['NATIONAL', 'Division / ČFL / MSFL'],
      ['REGIONAL', 'Regional competitions'],
      ['DISTRICT', 'District competitions'],
      ['FORMER_OTHER', 'Former referee / Other']
    ]
  };

  function enhanceRegistrationForm(form) {
    if (!form || form.dataset.facrFieldsEnhanced === 'true') return;

    const refereeSelect = form.querySelector('select[name="refereeStatus"]');
    const refereeLabel = refereeSelect?.closest('label');
    if (!refereeSelect || !refereeLabel) return;

    const language = document.documentElement.lang === 'en' ? 'en' : 'cs';
    const isCzech = language === 'cs';

    form.dataset.facrFieldsEnhanced = 'true';
    refereeSelect.name = 'refereeRole';

    const facrLabel = document.createElement('label');
    facrLabel.innerHTML = `
      ${isCzech ? 'ID FAČR' : 'FAČR ID'}
      <input
        name="facrId"
        type="text"
        inputmode="numeric"
        pattern="[0-9]+"
        maxlength="20"
        autocomplete="off"
        placeholder="${isCzech ? 'Zadejte své ID FAČR' : 'Enter your FAČR ID'}"
        required
      >
    `;

    const competitionLabel = document.createElement('label');
    competitionLabel.innerHTML = `
      ${isCzech ? 'Na jaké listině rozhodčích jste?' : 'Which referee list are you on?'}
      <select name="competitionLevel" required>
        <option value="" selected disabled>
          ${isCzech ? 'Vyberte úroveň soutěže' : 'Select competition level'}
        </option>
        ${competitionOptions[language]
          .map(([value, label]) => `<option value="${value}">${label}</option>`)
          .join('')}
      </select>
    `;

    const storedStatus = document.createElement('input');
    storedStatus.type = 'hidden';
    storedStatus.name = 'refereeStatus';

    refereeLabel.before(facrLabel, competitionLabel);
    refereeLabel.after(storedStatus);

    form.addEventListener(
      'submit',
      () => {
        const facrId = String(form.elements.facrId?.value || '').trim();
        const role = String(form.elements.refereeRole?.value || '').trim();
        const competitionSelect = form.elements.competitionLevel;
        const competition = competitionSelect?.selectedOptions?.[0]?.textContent?.trim() || '';

        storedStatus.value = [
          role,
          facrId ? `ID FAČR: ${facrId}` : '',
          competition ? `${isCzech ? 'Listina' : 'Referee list'}: ${competition}` : ''
        ]
          .filter(Boolean)
          .join(' | ');
      },
      true
    );
  }

  function scan(root = document) {
    if (root.matches?.('#joinForm')) enhanceRegistrationForm(root);
    root.querySelectorAll?.('#joinForm').forEach(enhanceRegistrationForm);
  }

  scan();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();