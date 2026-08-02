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

  const regionOptions = {
    cs: [
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
      'Moravskoslezský kraj'
    ],
    en: [
      'Prague',
      'Central Bohemian Region',
      'South Bohemian Region',
      'Plzeň Region',
      'Karlovy Vary Region',
      'Ústí nad Labem Region',
      'Liberec Region',
      'Hradec Králové Region',
      'Pardubice Region',
      'Vysočina Region',
      'South Moravian Region',
      'Olomouc Region',
      'Zlín Region',
      'Moravian-Silesian Region'
    ]
  };

  function ensureStyles() {
    if (document.getElementById('ucfr-registration-fields-style')) return;

    const style = document.createElement('style');
    style.id = 'ucfr-registration-fields-style';
    style.textContent = `
      #joinForm .registration-consent {
        display: grid !important;
        grid-template-columns: 22px minmax(0, 1fr) !important;
        align-items: start !important;
        gap: 10px !important;
        line-height: 1.55;
        font-weight: 500;
      }
      #joinForm .registration-consent input {
        width: 18px;
        height: 18px;
        margin: 3px 0 0;
      }
      #joinForm .required-marker {
        color: #c5162e;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  function replaceRegionField(form, language) {
    const regionInput = form.querySelector('input[name="region"]');
    if (!regionInput) return;

    const regionSelect = document.createElement('select');
    regionSelect.name = 'region';
    regionSelect.required = true;
    regionSelect.innerHTML = `
      <option value="" selected disabled>
        ${language === 'cs' ? 'Vyberte kraj' : 'Select a region'}
      </option>
      ${regionOptions[language]
        .map((label) => `<option value="${label}">${label}</option>`)
        .join('')}
    `;

    regionInput.replaceWith(regionSelect);
  }

  function replaceConsentField(form, language) {
    const originalConsent = form
      .querySelector('label.check input[type="checkbox"]')
      ?.closest('label');

    if (!originalConsent) return;

    const statutesConsent = document.createElement('label');
    statutesConsent.className = 'check registration-consent';
    statutesConsent.innerHTML = `
      <input type="checkbox" name="statutesConsent" value="yes" required>
      <span>${language === 'cs'
        ? 'Prohlašuji, že jsem se seznámil/a se stanovami Unie českých fotbalových rozhodčích, souhlasím s nimi a zavazuji se je dodržovat.'
        : 'I declare that I have read the statutes of the Union of Czech Football Referees, agree with them and undertake to comply with them.'}</span>
    `;

    const privacyConsent = document.createElement('label');
    privacyConsent.className = 'check registration-consent';
    privacyConsent.innerHTML = `
      <input type="checkbox" name="privacyNoticeAcknowledged" value="yes" required>
      <span>${language === 'cs'
        ? 'Beru na vědomí informace o zpracování osobních údajů Unií českých fotbalových rozhodčích, z. s., pro účely vedení členské evidence, ověření podmínek členství a komunikace související s členstvím.'
        : 'I acknowledge the information on the processing of personal data by the Union of Czech Football Referees for maintaining membership records, verifying membership requirements and membership-related communication.'}</span>
    `;

    originalConsent.replaceWith(statutesConsent, privacyConsent);
  }

  function configureFacrValidation(input, isCzech) {
    const requiredMessage = isCzech
      ? 'ID FAČR je povinné. Vyplňte prosím své ID FAČR.'
      : 'FAČR ID is required. Please enter your FAČR ID.';
    const numericMessage = isCzech
      ? 'ID FAČR může obsahovat pouze číslice.'
      : 'FAČR ID may contain digits only.';

    input.addEventListener('invalid', () => {
      if (input.validity.valueMissing) input.setCustomValidity(requiredMessage);
      else if (input.validity.patternMismatch) input.setCustomValidity(numericMessage);
      else input.setCustomValidity('');
    });

    input.addEventListener('input', () => {
      input.setCustomValidity('');
    });
  }

  function enhanceRegistrationForm(form) {
    if (!form || form.dataset.facrFieldsEnhanced === 'true') return;

    const refereeSelect = form.querySelector('select[name="refereeStatus"]');
    const refereeLabel = refereeSelect?.closest('label');
    if (!refereeSelect || !refereeLabel) return;

    const language = document.documentElement.lang === 'en' ? 'en' : 'cs';
    const isCzech = language === 'cs';

    ensureStyles();
    replaceRegionField(form, language);
    replaceConsentField(form, language);

    form.dataset.facrFieldsEnhanced = 'true';
    refereeSelect.name = 'refereeRole';

    const facrLabel = document.createElement('label');
    facrLabel.innerHTML = `
      ${isCzech ? 'ID FAČR' : 'FAČR ID'}
      <span class="required-marker">(${isCzech ? 'povinné' : 'required'})</span>
      <input
        name="facrId"
        type="text"
        inputmode="numeric"
        pattern="[0-9]+"
        maxlength="20"
        autocomplete="off"
        aria-required="true"
        placeholder="${isCzech ? 'Zadejte své ID FAČR' : 'Enter your FAČR ID'}"
        required
      >
    `;

    const facrInput = facrLabel.querySelector('input[name="facrId"]');
    configureFacrValidation(facrInput, isCzech);

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
      (event) => {
        const facrId = String(form.elements.facrId?.value || '').trim();

        if (!facrId) {
          event.preventDefault();
          facrInput.setCustomValidity(
            isCzech
              ? 'ID FAČR je povinné. Vyplňte prosím své ID FAČR.'
              : 'FAČR ID is required. Please enter your FAČR ID.'
          );
          facrInput.reportValidity();
          facrInput.focus();
          return;
        }

        const role = String(form.elements.refereeRole?.value || '').trim();
        const competitionSelect = form.elements.competitionLevel;
        const competition = competitionSelect?.selectedOptions?.[0]?.textContent?.trim() || '';

        storedStatus.value = [
          role,
          `ID FAČR: ${facrId}`,
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