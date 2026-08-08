(() => {
  'use strict';

  const REFFGUARD_URL = 'https://reff-guardpro.vercel.app/demo';
  const QUESTION_BANK_COUNT = 1219;
  const ACTIVE_ADMIN_TAB_KEY = 'ucfr-admin-active-tab';

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
  }

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('cs-CZ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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

  const icons = {
    exam: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="13" r="7"></circle>
        <path d="M12 13V9m0 4 3 2M9 2h6M12 6V3m5.2 3.8 1.4-1.4"></path>
      </svg>
    `,
    football: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="m12 7 3 2-1 3h-4L9 9l3-2Zm-3 2-3 1-1 3 2 3 3-1m5-6 3 1 1 3-2 3-3-1m-4 0 2 3h4l2-3"></path>
      </svg>
    `,
    results: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V10m5 9V5m5 14v-7m4 7H3"></path>
      </svg>
    `,
    video: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="3"></rect>
        <path d="m10 9 5 3-5 3V9Z"></path>
      </svg>
    `,
    shield: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 19 6v5c0 4.7-2.8 8.2-7 10-4.2-1.8-7-5.3-7-10V6l7-3Z"></path>
        <circle cx="12" cy="10" r="2"></circle>
        <path d="M8.8 16c.8-1.8 2-2.7 3.2-2.7s2.4.9 3.2 2.7"></path>
      </svg>
    `,
  };

  const pillarIcons = [
    `
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3 19 6v5c0 4.7-2.8 8.2-7 10-4.2-1.8-7-5.3-7-10V6l7-3Z"></path>
        <path d="m9 12 2 2 4-5"></path>
      </svg>
    `,
    `
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v17M6 6h12M4 10l3-4 3 4M14 10l3-4 3 4"></path>
        <path d="M3.5 10h7a3.5 3.5 0 0 1-7 0Zm10 0h7a3.5 3.5 0 0 1-7 0ZM8 20h8"></path>
      </svg>
    `,
    `
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="m3 9 9-5 9 5-9 5-9-5Z"></path>
        <path d="M7 12.5V17c3 2 7 2 10 0v-4.5M21 9v6"></path>
      </svg>
    `,
    `
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="8" cy="9" r="3"></circle>
        <circle cx="16" cy="9" r="3"></circle>
        <path d="M3 19c.5-3.3 2.3-5 5-5s4.5 1.7 5 5M11 19c.5-3.3 2.3-5 5-5s4.5 1.7 5 5"></path>
      </svg>
    `,
    `
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"></path>
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"></path>
      </svg>
    `,
    `
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 11v4a2 2 0 0 0 2 2h2l2 4h3l-2-4 8-3V8L8 5H6a2 2 0 0 0-2 2v4Z"></path>
        <path d="M19 9c1 .7 1.5 1.7 1.5 3S20 14.3 19 15"></path>
      </svg>
    `,
  ];

  function setCardIcon(card, markup) {
    const icon = card?.querySelector('.test-mode-icon');
    if (!icon || icon.dataset.ucfrPolishedIcon === '1') return;
    icon.dataset.ucfrPolishedIcon = '1';
    icon.innerHTML = markup;
  }

  function polishPillarIcons() {
    document.querySelectorAll('#about .grid.cards .card').forEach((card, index) => {
      const icon = card.querySelector('.icon');
      if (!icon || !pillarIcons[index]) return;
      icon.innerHTML = pillarIcons[index];
      icon.style.color = '#0c2848';
    });
  }

  function ensureQuestionCountBadge(exam) {
    if (!exam) return;
    let badge = exam.querySelector('.ucfr-question-count-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'ucfr-question-count-badge';
      exam.appendChild(badge);
    }
    badge.textContent = language() === 'cs'
      ? `${QUESTION_BANK_COUNT} otázek`
      : `${QUESTION_BANK_COUNT} questions`;
    badge.title = language() === 'cs'
      ? `Celkem ${QUESTION_BANK_COUNT} aktivních otázek v databázi`
      : `${QUESTION_BANK_COUNT} active questions in the question bank`;
  }

  function polishEducationCards() {
    const grid = document.querySelector('#tests .test-mode-grid');
    if (!grid) return;

    const exam = grid.querySelector('[data-test-mode="exam"]')?.closest('.test-mode-card');
    const football = grid.querySelector('#fotbaltesty-homepage-card');
    const results = grid.querySelector('[data-modal="results"]')?.closest('.test-mode-card');
    const video = grid.querySelector('.ucfr-video-analysis-card');

    [exam, football, results, video].filter(Boolean).forEach((card) => {
      card.classList.add('ucfr-polished-education-card');
    });

    setCardIcon(exam, icons.exam);
    setCardIcon(football, icons.football);
    setCardIcon(results, icons.results);
    setCardIcon(video, icons.video);
    ensureQuestionCountBadge(exam);
  }

  function removeActiveQuestionStat() {
    document.querySelectorAll('.admin-shell .admin-stats').forEach((stats) => {
      [...stats.querySelectorAll(':scope > article')].forEach((article) => {
        const text = normalize(article.textContent);
        if (/aktivnich otazek|active questions/.test(text)) {
          article.remove();
        }
      });
    });
  }

  function removeQuestionManagement() {
    document.querySelectorAll('.admin-shell').forEach((shell) => {
      let removedTests = false;

      [...shell.querySelectorAll(':scope > .admin-panel-section')].forEach((section) => {
        const label = normalize(section.querySelector('.section-label')?.textContent);
        const heading = normalize(section.querySelector('h3')?.textContent);
        const isQuestionManagement = label === 'testy'
          || label === 'tests'
          || /sprava testovych otazek|test question management/.test(heading);

        if (isQuestionManagement) {
          section.remove();
          removedTests = true;
        }
      });

      const testsTab = shell.querySelector('[data-admin-tab-target="tests"]');
      const testsWasActive = testsTab?.classList.contains('active')
        || sessionStorage.getItem(ACTIVE_ADMIN_TAB_KEY) === 'tests';

      if (testsTab) testsTab.remove();

      if ((removedTests || testsTab) && testsWasActive) {
        sessionStorage.setItem(ACTIVE_ADMIN_TAB_KEY, 'members');
        const membersTab = shell.querySelector('[data-admin-tab-target="members"]');
        if (membersTab) membersTab.click();
        else {
          shell.querySelectorAll(':scope > .admin-panel-section').forEach((section) => {
            section.hidden = section.dataset.adminTab !== 'members';
          });
        }
      }
    });
  }

  function buildExtras() {
    const quick = document.querySelector('#ucfrEducationQuickLinks');
    if (!quick) return;

    const lang = language();
    const admin = canAccessAdmin();
    const signature = `${lang}:${admin}`;
    if (quick.dataset.ucfrPolishSignature === signature && quick.querySelector('.ucfr-reffguard-card-final')) return;

    quick.dataset.ucfrPolishSignature = signature;
    quick.classList.add('ucfr-education-extras');
    quick.setAttribute('aria-label', lang === 'cs' ? 'Další nástroje' : 'Additional tools');

    quick.innerHTML = `
      ${admin ? `
        <button class="ucfr-education-admin-link" data-modal="admin" type="button">
          ⚙️ ${lang === 'cs' ? 'Administrace' : 'Administration'}
        </button>
      ` : ''}
      <article class="ucfr-reffguard-card-final">
        <div class="ucfr-reffguard-icon">${icons.shield}</div>
        <div class="ucfr-reffguard-copy">
          <h3>ReffGuard</h3>
          <p>${lang === 'cs' ? 'Aplikace pro delegování rozhodčích' : 'Application for referee appointments'}</p>
        </div>
        <a class="ucfr-reffguard-cta" href="${REFFGUARD_URL}" target="_blank" rel="noopener noreferrer">
          ${lang === 'cs' ? 'Otevřít ReffGuard' : 'Open ReffGuard'} ↗
        </a>
      </article>
    `;
  }

  function apply() {
    polishPillarIcons();
    polishEducationCards();
    removeActiveQuestionStat();
    removeQuestionManagement();
    buildExtras();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      apply();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const resultButton = event.target.closest?.('.test-result [data-modal="results"]');
    if (resultButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const boundResultsButton = document.querySelector('#tests [data-modal="results"]');
      if (boundResultsButton && boundResultsButton !== resultButton) {
        boundResultsButton.click();
      }
      return;
    }

    if (event.target.closest?.('#langBtn, #logoutBtn')) {
      window.setTimeout(apply, 100);
    }
  }, true);
})();
