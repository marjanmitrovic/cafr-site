(() => {
  'use strict';

  const VIDEO_URL = 'https://youtube.com/@refacademy?si=nvtPkzVsGe30KaRA';
  const REGISTER_URL = 'https://or.justice.cz/ias/ui/rejstrik-firma.vysledky?subjektId=1306981&typ=PLATNY';
  const DOCUMENT_URL = 'https://or.justice.cz/ias/ui/vypis-sl-detail?dokument=89888399&subjektId=1306981&spis=1476835';
  const LOGO_URL = '/assets/ucfr-logo.png?v=7';
  const CONTACT_EMAIL = 'unierozhodcich@gmail.com';

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
  }

  function ensureThemeButton() {
    const actions = document.querySelector('.topbar .actions');
    if (!actions || actions.querySelector('[data-theme-toggle]')) return;

    const button = document.createElement('button');
    button.id = 'siteThemeToggle';
    button.type = 'button';
    button.className = 'theme-toggle-btn site-theme-toggle';
    button.dataset.themeToggle = 'true';
    button.setAttribute('aria-label', language() === 'en' ? 'Switch theme' : 'Přepnout motiv');
    button.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true">☾</span>';

    const languageButton = actions.querySelector('#langBtn');
    if (languageButton) languageButton.insertAdjacentElement('afterend', button);
    else actions.prepend(button);
  }

  function updateBrandHeader() {
    const brand = document.querySelector('.brand');
    if (!brand) return;

    const logo = brand.querySelector('img');
    if (logo && logo.getAttribute('src') !== LOGO_URL) {
      logo.setAttribute('src', LOGO_URL);
      logo.hidden = false;
    }

    const strong = brand.querySelector('strong');
    if (strong) {
      const name = language() === 'en'
        ? 'Union of Czech Football Referees'
        : 'Unie českých fotbalových rozhodčích';
      if (strong.textContent.trim() !== name) strong.textContent = name;
      strong.classList.add('ucfr-full-brand-name');
    }

    const subtitle = brand.querySelector('span');
    if (subtitle) subtitle.hidden = true;
  }

  function updateMemberExample() {
    document.querySelectorAll('.member-card h3').forEach((heading) => {
      if (heading.textContent.trim().toUpperCase() === 'PETR TLUSTOHLAVY') {
        heading.textContent = 'PETR ROZHODČÍ';
      }
    });
  }

  function updateIco() {
    document.querySelectorAll('.footer-brand p').forEach((paragraph) => {
      if (paragraph.textContent.includes('IČO: bude doplněno')) {
        paragraph.innerHTML = paragraph.innerHTML.replace('IČO: bude doplněno', 'IČO: 24417513');
      }
    });
  }

  function updateContactEmail() {
    const footer = document.querySelector('footer#contact');
    if (!footer) return;

    footer.querySelectorAll('p').forEach((paragraph) => {
      const text = paragraph.textContent || '';
      if (text.includes('info@cafr.cz') || text.includes(CONTACT_EMAIL)) {
        paragraph.innerHTML = `<a class="footer-link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><br>Praha, Česká republika`;
      }
    });
  }

  function updateDocuments() {
    const section = document.querySelector('#documents.documents-section');
    if (!section) return;

    const lang = language();
    if (section.dataset.ucfrOfficialDocuments === lang) return;
    section.dataset.ucfrOfficialDocuments = lang;

    section.innerHTML = `
      <div>
        <span class="section-label">DOCUMENTS</span>
        <h2>${lang === 'cs' ? 'Oficiální dokumenty UČFR' : 'Official UČFR documents'}</h2>
        <p>${lang === 'cs'
          ? 'Ověřené údaje spolku a veřejné listiny vedené Ministerstvem spravedlnosti České republiky.'
          : 'Verified association details and public documents maintained by the Ministry of Justice of the Czech Republic.'}</p>
      </div>
      <div class="document-links">
        <a class="document-link" href="${REGISTER_URL}" target="_blank" rel="noopener noreferrer">
          📄 ${lang === 'cs' ? 'Veřejný rejstřík spolku' : 'Public register entry'}
        </a>
        <a class="document-link" href="${DOCUMENT_URL}" target="_blank" rel="noopener noreferrer">
          📄 ${lang === 'cs' ? 'Sbírka listin – dokument 89888399' : 'Collection of documents – document 89888399'}
        </a>
      </div>
    `;
  }

  function updateVideoAnalysis() {
    const grid = document.querySelector('#tests .test-mode-grid');
    if (!grid) return;

    const lang = language();
    let card = grid.querySelector('.ucfr-video-analysis-card');

    if (!card) {
      card = document.createElement('article');
      card.className = 'test-mode-card ucfr-video-analysis-card';
      const resultsCard = [...grid.children].find((item) =>
        item.textContent.includes('Moje výsledky') || item.textContent.includes('My results')
      );
      if (resultsCard) grid.insertBefore(card, resultsCard);
      else grid.appendChild(card);
    }

    card.innerHTML = `
      <div class="test-mode-icon">🎥</div>
      <h3>${lang === 'cs' ? 'Video analýzy' : 'Video analysis'}</h3>
      <p>${lang === 'cs'
        ? 'Rozbory herních situací a rozhodnutí rozhodčích.'
        : 'Breakdowns of match situations and refereeing decisions.'}</p>
      <a class="secondary dark video-analysis-link" href="${VIDEO_URL}" target="_blank" rel="noopener noreferrer">
        ${lang === 'cs' ? 'Otevřít Ref Academy' : 'Open Ref Academy'}
      </a>
    `;
  }

  function applyUpdates() {
    ensureThemeButton();
    updateBrandHeader();
    updateMemberExample();
    updateIco();
    updateContactEmail();
    updateDocuments();
    updateVideoAnalysis();
  }

  function applyAfterRender(delay = 0) {
    window.setTimeout(applyUpdates, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyUpdates, { once: true });
  } else {
    applyUpdates();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#langBtn, #logoutBtn')) applyAfterRender(0);
  });

  document.addEventListener('submit', () => applyAfterRender(150));
  window.addEventListener('pageshow', applyUpdates);
})();