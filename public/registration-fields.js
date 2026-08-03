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
      #joinForm .registration-consent .required-marker {
        display: none !important;
      }
      #joinForm .required-marker {
        color: #c5162e;
        font-weight: 800;
      }
      #joinForm .registration-validation-message {
        display: none;
        margin: 0;
        padding: 12px 14px;
        border: 1px solid #efb8bd;
        border-radius: 10px;
        background: #fff0f1;
        color: #a8121e;
        font-size: 14px;
        font-weight: 750;
        line-height: 1.5;
      }
      #joinForm .registration-validation-message.show {
        display: block;
      }
      #joinForm [aria-invalid="true"] {
        border-color: #c5162e !important;
        box-shadow: 0 0 0 3px rgba(197, 22, 46, 0.1);
      }
    `;
    document.head.appendChild(style);
  }

  function replaceRegionField(form, language) {
    const regionInput = form.querySelector('input[name="region"]');
    if (!regionInput) return form.querySelector('select[name="region"]');

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
    return regionSelect;
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

  function addRequiredMarker(control, language) {
    const label = control?.closest('label');
    if (!label || label.querySelector('.required-marker')) return;

    const marker = document.createElement('span');
    marker.className = 'required-marker';
    marker.textContent = `(${language === 'cs' ? 'povinné' : 'required'})`;
    label.insertBefore(marker, control);
  }

  function customMessage(control, language) {
    const cs = language === 'cs';
    const name = control.name;

    if (control.type === 'checkbox') {
      return cs
        ? 'Pro odeslání přihlášky je nutné potvrdit tento souhlas.'
        : 'This consent must be confirmed before submitting the application.';
    }

    if (control.validity.typeMismatch) {
      return cs ? 'Zadejte platnou e-mailovou adresu.' : 'Enter a valid email address.';
    }

    if (control.validity.tooShort) {
      return cs
        ? `Heslo musí obsahovat alespoň ${control.minLength} znaků.`
        : `The password must contain at least ${control.minLength} characters.`;
    }

    if (control.validity.patternMismatch && name === 'facrId') {
      return cs ? 'ID FAČR může obsahovat pouze číslice.' : 'FAČR ID may contain digits only.';
    }

    const labels = {
      name: cs ? 'Jméno a příjmení' : 'Full name',
      email: 'E-mail',
      password: cs ? 'Heslo' : 'Password',
      phone: cs ? 'Telefon' : 'Phone',
      region: cs ? 'Kraj / okres' : 'Region / district',
      refereeRole: cs ? 'Status rozhodčího' : 'Referee status',
      facrId: cs ? 'ID FAČR' : 'FAČR ID',
      competitionLevel: cs ? 'Listina rozhodčích' : 'Referee list',
    };

    return cs
      ? `Pole „${labels[name] || 'Toto pole'}“ je povinné.`
      : `The field “${labels[name] || 'This field'}” is required.`;
  }

  function configureControlValidation(control, language) {
    if (!control || control.dataset.ucfrValidationConfigured === 'true') return;
    control.dataset.ucfrValidationConfigured = 'true';
    control.required = true;
    control.setAttribute('aria-required', 'true');
    if (control.type !== 'checkbox') addRequiredMarker(control, language);

    control.addEventListener('invalid', () => {
      control.setCustomValidity('');
      control.setCustomValidity(customMessage(control, language));
      control.setAttribute('aria-invalid', 'true');
    });

    const clear = () => {
      control.setCustomValidity('');
      control.removeAttribute('aria-invalid');
    };
    control.addEventListener('input', clear);
    control.addEventListener('change', clear);
  }

  function ensureStatusPlaceholder(select, language) {
    if (!select || select.querySelector('option[value=""]')) return;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = language === 'cs' ? 'Vyberte status rozhodčího' : 'Select referee status';
    select.prepend(placeholder);
    select.selectedIndex = 0;
  }

  function ensureValidationMessage(form, language) {
    let message = form.querySelector('#registrationValidationMessage');
    if (message) return message;

    message = document.createElement('p');
    message.id = 'registrationValidationMessage';
    message.className = 'registration-validation-message';
    message.setAttribute('role', 'alert');
    message.setAttribute('aria-live', 'assertive');
    message.textContent = language === 'cs'
      ? 'Přihlášku nelze odeslat. Vyplňte prosím všechna povinná pole a potvrďte oba souhlasy.'
      : 'The application cannot be submitted. Complete all required fields and confirm both consents.';

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) form.insertBefore(message, submitButton);
    else form.appendChild(message);
    return message;
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
    ensureStatusPlaceholder(refereeSelect, language);

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

    const competitionLabel = document.createElement('label');
    competitionLabel.innerHTML = `
      ${isCzech ? 'Na jaké listině rozhodčích jste?' : 'Which referee list are you on?'}
      <span class="required-marker">(${isCzech ? 'povinné' : 'required'})</span>
      <select name="competitionLevel" required aria-required="true">
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

    const requiredControls = [
      form.elements.name,
      form.elements.email,
      form.elements.password,
      form.elements.phone,
      form.elements.region,
      form.elements.refereeRole,
      form.elements.facrId,
      form.elements.competitionLevel,
      form.elements.statutesConsent,
      form.elements.privacyNoticeAcknowledged,
    ].filter(Boolean);

    requiredControls.forEach((control) => configureControlValidation(control, language));
    const validationMessage = ensureValidationMessage(form, language);

    const refreshMessage = () => {
      if (requiredControls.every((control) => control.validity.valid)) {
        validationMessage.classList.remove('show');
      }
    };
    form.addEventListener('input', refreshMessage);
    form.addEventListener('change', refreshMessage);

    form.addEventListener(
      'submit',
      (event) => {
        requiredControls.forEach((control) => {
          if (control.matches('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input:not([type])')) {
            if (!String(control.value || '').trim()) {
              control.setCustomValidity(customMessage(control, language));
              control.setAttribute('aria-invalid', 'true');
            }
          }
        });

        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          validationMessage.classList.add('show');
          validationMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });

          const firstInvalid = form.querySelector(':invalid');
          if (firstInvalid) {
            firstInvalid.focus({ preventScroll: true });
            firstInvalid.reportValidity();
          }
          return;
        }

        const facrId = String(form.elements.facrId.value || '').trim();
        const role = String(form.elements.refereeRole.value || '').trim();
        const competitionSelect = form.elements.competitionLevel;
        const competition = competitionSelect.selectedOptions?.[0]?.textContent?.trim() || '';

        storedStatus.value = [
          role,
          `ID FAČR: ${facrId}`,
          `${isCzech ? 'Listina' : 'Referee list'}: ${competition}`
        ].join(' | ');
        validationMessage.classList.remove('show');
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
