(() => {
  'use strict';

  const VIDEO_URL = 'https://youtube.com/@refacademy?si=nvtPkzVsGe30KaRA';
  const REGISTER_URL = 'https://or.justice.cz/ias/ui/rejstrik-firma.vysledky?subjektId=1306981&typ=PLATNY';
  const DOCUMENT_URL = 'https://or.justice.cz/ias/ui/vypis-sl-detail?dokument=89888399&subjektId=1306981&spis=1476835';

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
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
        <p>${
          lang === 'cs'
            ? 'Ověřené údaje spolku a veřejné listiny vedené Ministerstvem spravedlnosti České republiky.'
            : 'Verified association details and public documents maintained by the Ministry of Justice of the Czech Republic.'
        }</p>
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

  function addVideoAnalysis() {
    const grid = document.querySelector('#tests .test-mode-grid');
    if (!grid || grid.querySelector('.ucfr-video-analysis-card')) return;

    const lang = language();
    const card = document.createElement('article');
    card.className = 'test-mode-card ucfr-video-analysis-card';
    card.innerHTML = `
      <div class="test-mode-icon">🎥</div>
      <h3>${lang === 'cs' ? 'Video analýzy' : 'Video analysis'}</h3>
      <p>${
        lang === 'cs'
          ? 'Rozbory herních situací a rozhodnutí rozhodčích.'
          : 'Breakdowns of match situations and refereeing decisions.'
      }</p>
      <a class="secondary dark video-analysis-link" href="${VIDEO_URL}" target="_blank" rel="noopener noreferrer">
        ${lang === 'cs' ? 'Otevřít Ref Academy' : 'Open Ref Academy'}
      </a>
    `;

    const resultsCard = [...grid.children].find((item) => item.textContent.includes('Moje výsledky') || item.textContent.includes('My results'));
    if (resultsCard) grid.insertBefore(card, resultsCard);
    else grid.appendChild(card);
  }

  function applyUpdates() {
    updateMemberExample();
    updateIco();
    updateDocuments();
    addVideoAnalysis();
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      applyUpdates();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
