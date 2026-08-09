(() => {
  'use strict';

  const STATUTES = [
    {
      title: 'Stanovy UČFR – aktualizované',
      description: 'Aktualizované stanovy Unie českých fotbalových rozhodčích.',
      url: '/documents/Stanovy_CAFR_aktualizovane.pdf',
    },
    {
      title: 'Stanovy UČFR – návrh',
      description: 'Návrh stanov Unie českých fotbalových rozhodčích.',
      url: '/documents/Stanovy_CAFR_navrh.pdf',
    },
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function injectStatutes() {
    const list = document.querySelector('#dashboardView .document-list');
    if (!list) return;

    STATUTES.forEach((document) => {
      if (list.querySelector(`[data-static-document="${document.url}"]`)) return;

      const card = document.createElement('article');
      card.className = 'document-card member-static-statute';
      card.dataset.staticDocument = document.url;
      card.innerHTML = `
        <div>
          <span class="section-label">STANOVY</span>
          <h3>${escapeHtml(document.title)}</h3>
          <p>${escapeHtml(document.description)}</p>
          <small>PDF · členský dokument</small>
        </div>
        <a class="secondary dark" href="${escapeHtml(document.url)}" target="_blank" rel="noopener">Otevřít</a>
      `;
      list.prepend(card);
    });

    const empty = list.querySelector('.empty-results');
    if (empty) empty.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStatutes, { once: true });
  } else {
    injectStatutes();
  }

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      injectStatutes();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
