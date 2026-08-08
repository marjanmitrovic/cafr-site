(() => {
  'use strict';

  const VIDEO_URL = 'https://youtube.com/@refacademy?si=nvtPkzVsGe30KaRA';
  const REFFGUARD_URL = 'https://reff-guardpro.vercel.app/demo';
  const REGISTER_URL = 'https://or.justice.cz/ias/ui/rejstrik-firma.vysledky?subjektId=1306981&typ=PLATNY';
  const DOCUMENT_URL = 'https://or.justice.cz/ias/ui/vypis-sl-detail?dokument=89888399&subjektId=1306981&spis=1476835';
  const LOGO_URL = '/assets/ucfr-logo.png?v=11';
  const INFO_EMAIL = 'info@ucfr.cz';
  const MEDIA_EMAIL = 'media@ucfr.cz';

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem('cafr-user') || 'null');
    } catch {
      return null;
    }
  }

  function canAccessAdmin() {
    return ['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(currentUser()?.role);
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

    const lang = language();
    const contactBlock = [...footer.children].find((element) =>
      element.querySelector?.('b')?.textContent.trim() === 'Kontakt'
    );

    if (!contactBlock) return;

    const paragraph = contactBlock.querySelector('p') || document.createElement('p');
    const signature = `${lang}:${INFO_EMAIL}:${MEDIA_EMAIL}`;
    if (paragraph.dataset.ucfrContactSignature === signature) return;
    paragraph.dataset.ucfrContactSignature = signature;
    paragraph.innerHTML = `
      <strong>${lang === 'en' ? 'General enquiries' : 'Obecný kontakt'}:</strong><br>
      <a class="footer-link" href="mailto:${INFO_EMAIL}">${INFO_EMAIL}</a><br><br>
      <strong>${lang === 'en' ? 'Media' : 'Média'}:</strong><br>
      <a class="footer-link" href="mailto:${MEDIA_EMAIL}">${MEDIA_EMAIL}</a><br><br>
      Praha, Česká republika
    `;

    if (!paragraph.parentElement) contactBlock.appendChild(paragraph);
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

  function removePracticeMode() {
    const practiceButton = document.querySelector('#tests [data-test-mode="practice"]');
    const practiceCard = practiceButton?.closest('.test-mode-card');
    if (practiceCard) practiceCard.remove();
  }

  function removePillarLinks() {
    document.querySelectorAll('#about .grid.cards .card > a').forEach((link) => link.remove());
  }

  function examCardIn(grid) {
    return grid.querySelector('[data-test-mode="exam"]')?.closest('.test-mode-card') || null;
  }

  function resultsCardIn(grid) {
    return grid.querySelector('[data-modal="results"]')?.closest('.test-mode-card') ||
      [...grid.children].find((item) => item.textContent.includes('Moje výsledky') || item.textContent.includes('My results')) ||
      null;
  }

  function removeAdminCard() {
    const grid = document.querySelector('#tests .test-mode-grid');
    const adminCard = grid?.querySelector('[data-modal="admin"]')?.closest('.test-mode-card') ||
      grid?.querySelector('.admin-card');
    if (adminCard) adminCard.remove();
  }

  function updateVideoAnalysis() {
    const grid = document.querySelector('#tests .test-mode-grid');
    if (!grid) return;

    const lang = language();
    let card = grid.querySelector('.ucfr-video-analysis-card');

    if (!card) {
      card = document.createElement('article');
      card.className = 'test-mode-card ucfr-video-analysis-card';
      grid.appendChild(card);
    }

    if (card.dataset.ucfrLanguage === lang) return;
    card.dataset.ucfrLanguage = lang;
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

  function ensureCompactLinkStyles() {
    if (document.querySelector('#ucfrCompactEducationLinksStyles')) return;
    const style = document.createElement('style');
    style.id = 'ucfrCompactEducationLinksStyles';
    style.textContent = `
      .ucfr-education-quick-links {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px 22px;
        padding: 14px 20px 22px;
      }
      .ucfr-education-quick-link {
        appearance: none;
        border: 0;
        padding: 0;
        background: transparent;
        color: #0b5aa5;
        font: inherit;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
      }
      .ucfr-education-quick-link:hover,
      .ucfr-education-quick-link:focus-visible {
        text-decoration: underline;
      }
      .ucfr-education-quick-link + .ucfr-education-quick-link::before {
        content: '•';
        display: inline-block;
        margin-right: 22px;
        color: #8a97a8;
        text-decoration: none;
      }
      @media (max-width: 640px) {
        .ucfr-education-quick-links {
          align-items: flex-start;
          flex-direction: column;
          gap: 9px;
          padding-inline: 20px;
        }
        .ucfr-education-quick-link + .ucfr-education-quick-link::before {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureQuickLinks() {
    const testsSection = document.querySelector('#tests');
    if (!testsSection) return;

    document.querySelector('#education-admin')?.remove();
    document.querySelector('#applications')?.remove();
    ensureCompactLinkStyles();

    let links = document.querySelector('#ucfrEducationQuickLinks');
    if (!links) {
      links = document.createElement('nav');
      links.id = 'ucfrEducationQuickLinks';
      links.className = 'ucfr-education-quick-links';
      links.setAttribute('aria-label', 'UČFR links');
      testsSection.insertAdjacentElement('afterend', links);
    }

    const lang = language();
    const adminLink = canAccessAdmin()
      ? `<button class="ucfr-education-quick-link" data-modal="admin" type="button">⚙️ ${lang === 'cs' ? 'Administrace' : 'Administration'}</button>`
      : '';
    const reffGuardText = lang === 'cs'
      ? 'ReffGuard – aplikace pro delegování rozhodčích'
      : 'ReffGuard – referee appointment application';
    const signature = `${lang}:${canAccessAdmin()}`;
    if (links.dataset.ucfrSignature === signature) return;
    links.dataset.ucfrSignature = signature;
    links.innerHTML = `
      ${adminLink}
      <a class="ucfr-education-quick-link" href="${REFFGUARD_URL}" target="_blank" rel="noopener noreferrer">🛡️ ${reffGuardText} ↗</a>
    `;
  }

  function organizeEducationCards() {
    const grid = document.querySelector('#tests .test-mode-grid');
    if (!grid) return;

    const wanted = [
      examCardIn(grid),
      grid.querySelector('#fotbaltesty-homepage-card'),
      resultsCardIn(grid),
      grid.querySelector('.ucfr-video-analysis-card'),
    ].filter(Boolean);

    if (!wanted.length) return;
    const relevant = [...grid.children].filter((card) => wanted.includes(card));
    const alreadyOrdered = wanted.length === relevant.length && wanted.every((card, index) => relevant[index] === card);
    if (alreadyOrdered) return;

    wanted.forEach((card) => grid.appendChild(card));
  }

  function applyEducationLayout() {
    removePracticeMode();
    removePillarLinks();
    removeAdminCard();
    updateVideoAnalysis();
    ensureQuickLinks();
    organizeEducationCards();
  }

  function applyUpdates() {
    ensureThemeButton();
    updateBrandHeader();
    updateMemberExample();
    updateIco();
    updateContactEmail();
    updateDocuments();
    applyEducationLayout();
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
    if (event.target.closest?.('#langBtn, #logoutBtn')) {
      applyAfterRender(0);
      applyAfterRender(80);
    }
  });

  document.addEventListener('submit', () => applyAfterRender(150));
  window.addEventListener('pageshow', applyUpdates);

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      applyEducationLayout();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();