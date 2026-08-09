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

  function findDocumentsSection(shell) {
    const sections = [...shell.querySelectorAll(':scope > .admin-panel-section')];
    return sections.find((section) => section.dataset.adminTab === 'documents')
      || sections.find((section) => section.querySelector('#documentMessage'))
      || null;
  }

  function injectIntoAdmin() {
    document.querySelectorAll('.admin-shell').forEach((shell) => {
      const section = findDocumentsSection(shell);
      if (!section) return;

      const list = section.querySelector('.admin-member-list');
      if (!list) return;

      for (const item of [...STATUTES].reverse()) {
        const alreadyPresent = [...list.querySelectorAll('a[href]')].some((link) => {
          try {
            return new URL(link.getAttribute('href'), window.location.origin).pathname === item.url;
          } catch {
            return false;
          }
        });
        if (alreadyPresent || list.querySelector(`[data-static-statute="${item.url}"]`)) continue;

        const card = document.createElement('article');
        card.className = 'admin-member-card admin-static-statute';
        card.dataset.staticStatute = item.url;
        card.innerHTML = `
          <div class="admin-member-main">
            <div class="admin-member-avatar">PDF</div>
            <div>
              <h4>${escapeHtml(item.title)}</h4>
              <p>${escapeHtml(item.description)}</p>
              <div class="admin-member-meta">
                <span>STANOVY</span>
                <span>PUBLIC</span>
              </div>
            </div>
          </div>
          <div class="admin-member-controls">
            <a class="secondary dark" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Otevřít</a>
          </div>
        `;
        list.prepend(card);
      }

      const total = list.querySelectorAll(':scope > .admin-member-card').length;
      const sectionCount = section.querySelector('.admin-count');
      if (sectionCount) sectionCount.textContent = String(total);

      const tabCount = shell.querySelector('[data-admin-tab-target="documents"] b');
      if (tabCount) tabCount.textContent = String(total);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectIntoAdmin, { once: true });
  } else {
    injectIntoAdmin();
  }

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      injectIntoAdmin();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
