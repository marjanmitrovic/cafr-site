(() => {
  'use strict';

  const STATUTES = [
    {
      cs: 'Stanovy UČFR – aktualizované',
      en: 'UČFR Statutes – updated',
      url: '/documents/Stanovy_CAFR_aktualizovane.pdf',
    },
    {
      cs: 'Stanovy UČFR – návrh',
      en: 'UČFR Statutes – draft',
      url: '/documents/Stanovy_CAFR_navrh.pdf',
    },
  ];

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
  }

  function inject() {
    const links = document.querySelector('#documents.documents-section .document-links');
    if (!links) return;

    const lang = language();
    for (const statute of STATUTES) {
      let link = [...links.querySelectorAll('a[href]')].find((item) => {
        try {
          return new URL(item.getAttribute('href'), window.location.origin).pathname === statute.url;
        } catch {
          return false;
        }
      });

      if (!link) {
        link = document.createElement('a');
        link.className = 'document-link ucfr-statute-link';
        link.href = statute.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.appendChild(link);
      }

      link.textContent = `📄 ${statute[lang]}`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#langBtn')) {
      window.setTimeout(inject, 0);
      window.setTimeout(inject, 100);
    }
  });

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      inject();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
