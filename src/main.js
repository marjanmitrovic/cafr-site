import './style.css';

const API_BASE =
  localStorage.getItem('cafr-api-base') ||
  (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : window.location.origin
  );

let lang = localStorage.getItem('cafr-lang') || 'cs';
let adminToken =
  sessionStorage.getItem('cafr-admin-token') || '';

let activeTest = null;
let timerId = null;

const copy = {
  cs: {
    nav: [
      'Domů',
      'O asociaci',
      'Členství',
      'Ochrana',
      'Aktuality',
      'Vzdělávání',
      'Dokumenty',
      'Kontakt'
    ],
    login: 'Přihlásit se',
    join: 'Stát se členem',
    report: 'Nahlásit incident',
    eyebrow: 'Nezávislá profesní komunita rozhodčích',
    hero: 'Silnější hlas. Bezpečnější prostředí. Lepší podmínky.',
    sub:
      'Unie českých fotbalových rozhodčích propojuje aktivní i bývalé rozhodčí a nabízí ochranu, vzdělávání, právní podporu a společné zastupování.',
    pillars: 'Hlavní pilíře činnosti',
    pillarsSub:
      'Praktická pomoc rozhodčím v každé fázi jejich působení.',
    cards: [
      ['Ochrana rozhodčích', 'Incidenty, výhrůžky, nátlak a krizové situace.'],
      ['Podmínky výkonu', 'Odměny, cestovní náhrady a důstojné pracovní podmínky.'],
      ['Vzdělávání a rozvoj', 'Semináře, mentoring, konzultace a rozbory situací.'],
      ['Komunita', 'Propojení rozhodčích napříč okresy a kraji.'],
      ['Právní podpora', 'Základní právní pomoc, vzory podání a konzultace.'],
      ['Reprezentace', 'Jednání s orgány českého fotbalu a institucemi.']
    ],
    news: 'Aktuality',
    testTitle: 'Ověřte si znalosti pravidel',
    membership: 'Členství, které má skutečný smysl',
    membershipText:
      'Členem se může stát současný nebo bývalý rozhodčí, asistent, videorozhodčí, delegát nebo pozorovatel rozhodčích. O přijetí rozhoduje Výkonný výbor.',
    apply: 'Podat přihlášku',
    close: 'Zavřít'
  },
  en: {
    nav: [
      'Home',
      'About',
      'Membership',
      'Protection',
      'News',
      'Education',
      'Documents',
      'Contact'
    ],
    login: 'Sign in',
    join: 'Become a member',
    report: 'Report an incident',
    eyebrow: 'Independent professional referee community',
    hero: 'A stronger voice. A safer environment. Better conditions.',
    sub:
      'The Union of Czech Football Referees connects active and former referees and provides protection, education, legal support and joint representation.',
    pillars: 'Our core pillars',
    pillarsSub: 'Practical support for referees at every stage of their career.',
    cards: [
      ['Referee protection', 'Incidents, threats, pressure and crisis situations.'],
      ['Working conditions', 'Fees, travel expenses and dignified conditions.'],
      ['Education and growth', 'Seminars, mentoring, consultations and match analysis.'],
      ['Community', 'Connecting referees across districts and regions.'],
      ['Legal support', 'Basic legal assistance, templates and consultations.'],
      ['Representation', 'Dialogue with Czech football bodies and institutions.']
    ],
    news: 'News',
    testTitle: 'Test your knowledge of the Laws',
    membership: 'Membership with real value',
    membershipText:
      'Membership is open to current or former referees, assistant referees, video match officials, delegates and referee observers. Admission is decided by the Executive Committee.',
    apply: 'Apply for membership',
    close: 'Close'
  }
};

const icons = ['🛡️', '⚖️', '🎓', '🤝', '📘', '📣'];
const ids = [
  'protection',
  'conditions',
  'tests',
  'community',
  'legal',
  'representation'
];

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]
  );
}


function renderAttachments(attachments = []) {
  if (!attachments?.length) return '';
  return `
    <div class="attachment-list">
      <strong>Přílohy</strong>
      ${attachments.map((attachment) => `
        <a href="${escapeHtml(attachment.fileUrl)}" target="_blank" rel="noopener">
          📎 ${escapeHtml(attachment.fileName)}
          <small>${Math.ceil(Number(attachment.sizeBytes || 0) / 1024)} KB</small>
        </a>
      `).join('')}
    </div>
  `;
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('cafr-user') || 'null');
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      `${response.status} ${response.statusText}`
    );
  }

  return data;
}

function flag() {
  if (lang === 'cs') {
    return `
      <span class="flag-icon flag-cz"></span>
      <span>CZ</span>
    `;
  }

  return `
    <span class="flag-icon flag-gb"></span>
    <span>EN</span>
  `;
}

function render() {
  const x = copy[lang];
  const currentUser = getCurrentUser();

  document.documentElement.lang = lang;

  document.querySelector('#app').innerHTML = `
    <header class="topbar">
      <a class="brand" href="#home">
        <img src="/assets/ucfr-logo.svg" alt="UČFR logo">
        <div>
          <strong>UČFR</strong>
          <span>
            ${
              lang === 'cs'
                ? 'Unie českých fotbalových rozhodčích'
                : 'Union of Czech Football Referees'
            }
          </span>
        </div>
      </a>

      <nav>
        ${x.nav
          .map(
            (name, index) => `
              <a href="#${
                [
                  'home',
                  'about',
                  'membership',
                  'protection',
                  'education',
                  'tests',
                  'documents',
                  'contact'
                ][index]
              }">
                ${name}
              </a>
            `
          )
          .join('')}
      </nav>

      <div class="actions">
        <button class="lang" id="langBtn" type="button">
          ${flag()}
        </button>

        ${
          currentUser
            ? `
              <button
                class="ghost"
                data-modal="profile"
                type="button"
              >
                ${escapeHtml(currentUser.firstName || 'Member')}
              </button>

              ${['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(currentUser.role) ? `
                <button
                  class="ghost"
                  id="adminPanelBtn"
                  type="button"
                >
                  ${lang === 'cs' ? 'Administrace' : 'Administration'}
                </button>
              ` : ''}

              <button
                class="primary small"
                id="logoutBtn"
                type="button"
              >
                ${
                  lang === 'cs'
                    ? 'Odhlásit'
                    : 'Sign out'
                }
              </button>
            `
            : `
              <button
                class="ghost"
                data-modal="login"
                type="button"
              >
                ${x.login}
              </button>

              <button
                class="primary small"
                data-modal="join"
                type="button"
              >
                ${x.join}
              </button>
            `
        }
      </div>

      <button class="menu" id="menuBtn" type="button">☰</button>
    </header>

    <main>
      <section class="hero" id="home">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <div class="eyebrow">${x.eyebrow}</div>
          <h1>${x.hero}</h1>
          <p>${x.sub}</p>

          <div class="hero-buttons">
            ${
              currentUser
                ? `
                  <button class="primary" data-modal="profile" type="button">
                    ${
                      lang === 'cs'
                        ? 'Můj profil'
                        : 'My profile'
                    }
                  </button>
                `
                : `
                  <button class="primary" data-modal="join" type="button">
                    ${x.join}
                  </button>
                `
            }

            <button class="secondary" data-modal="incident" type="button">
              ${x.report}
            </button>
          </div>

          <div class="stats">
            <div><b>250+</b><span>${lang === 'cs' ? 'členů' : 'members'}</span></div>
            <div><b>14</b><span>${lang === 'cs' ? 'krajů' : 'regions'}</span></div>
            <div><b>24</b><span>${lang === 'cs' ? 'seminářů' : 'seminars'}</span></div>
            <div><b>38</b><span>${lang === 'cs' ? 'řešených případů' : 'cases supported'}</span></div>
          </div>
        </div>
      </section>

      <section class="section" id="about">
        <div class="section-head">
          <span>UČFR</span>
          <h2>${x.pillars}</h2>
          <p>${x.pillarsSub}</p>
        </div>

        <div class="grid cards">
          ${x.cards
            .map(
              (card, index) => `
                <article class="card">
                  <div class="icon">${icons[index]}</div>
                  <h3>${card[0]}</h3>
                  <p>${card[1]}</p>
                  <a href="#${ids[index]}">
                    ${lang === 'cs' ? 'Zjistit více' : 'Learn more'} →
                  </a>
                </article>
              `
            )
            .join('')}
        </div>
      </section>

      <section class="incident" id="protection">
        <div>
          <span class="kicker">24/7 SUPPORT</span>
          <h2>
            ${
              lang === 'cs'
                ? 'Když se něco stane, nejste na to sami.'
                : 'When something happens, you are not alone.'
            }
          </h2>
          <p>
            ${
              lang === 'cs'
                ? 'Bezpečný formulář pro nahlášení napadení, výhrůžek, nátlaku nebo jiného incidentu.'
                : 'A secure form for reporting assault, threats, pressure or other incidents.'
            }
          </p>
          <button class="secondary light" data-modal="incident" type="button">
            ${x.report}
          </button>
        </div>

        <div class="shield">
          ⚠️
          <small>INCIDENT<br>SUPPORT</small>
        </div>
      </section>

      <section class="section education-hub" id="tests">
        <div class="section-head">
          <span>${lang === 'cs' ? 'VZDĚLÁVÁNÍ' : 'EDUCATION'}</span>
          <h2>${x.testTitle}</h2>
        </div>

        <div class="test-mode-grid">
          <article class="test-mode-card">
            <div class="test-mode-icon">🎯</div>
            <h3>${lang === 'cs' ? 'Procvičování' : 'Practice mode'}</h3>
            <p>${lang === 'cs' ? '10 otázek bez časového tlaku.' : '10 questions without time pressure.'}</p>
            <button class="primary" data-test-mode="practice" type="button">
              ${lang === 'cs' ? 'Spustit procvičování' : 'Start practice'}
            </button>
          </article>

          <article class="test-mode-card featured">
            <div class="test-mode-icon">⏱️</div>
            <h3>${lang === 'cs' ? 'Zkušební test' : 'Mock examination'}</h3>
            <p>${lang === 'cs' ? '10 otázek s limitem 10 minut.' : '10 questions with a 10-minute limit.'}</p>
            <button class="primary" data-test-mode="exam" type="button">
              ${lang === 'cs' ? 'Spustit test' : 'Start mock exam'}
            </button>
          </article>

          <article class="test-mode-card">
            <div class="test-mode-icon">📊</div>
            <h3>${lang === 'cs' ? 'Moje výsledky' : 'My results'}</h3>
            <button class="secondary dark" data-modal="results" type="button">
              ${lang === 'cs' ? 'Zobrazit výsledky' : 'View results'}
            </button>
          </article>

          <article class="test-mode-card admin-card">
            <div class="test-mode-icon">⚙️</div>
            <h3>${lang === 'cs' ? 'Administrace' : 'Administration'}</h3>
            <button class="secondary dark" data-modal="admin" type="button">
              ${lang === 'cs' ? 'Otevřít administraci' : 'Open administration'}
            </button>
          </article>
        </div>
      </section>

      <section class="membership" id="membership">
        <div class="membership-card">
          <div>
            <span class="section-label">MEMBERSHIP</span>
            <h2>${x.membership}</h2>
            <p>${x.membershipText}</p>

            ${
              currentUser
                ? `
                  <button class="primary" data-modal="profile" type="button">
                    ${lang === 'cs' ? 'Otevřít členský profil' : 'Open member profile'}
                  </button>
                `
                : `
                  <button class="primary" data-modal="join" type="button">
                    ${x.apply}
                  </button>
                `
            }
          </div>

          <div class="member-card">
            <img src="/assets/ucfr-logo.svg" alt="UČFR">
            <small>ČLENSKÝ PRŮKAZ</small>
            <h3>
              ${
                currentUser
                  ? `${escapeHtml(currentUser.firstName)} ${escapeHtml(currentUser.lastName)}`
                  : 'PETR TLUSTOHLAVY'
              }
            </h3>
            <p>
              ID:
              ${
                currentUser?.id
                  ? `UCFR-${String(currentUser.id).slice(-8).toUpperCase()}`
                  : 'UCFR-2026-001'
              }
            </p>
            ${
              currentUser
                ? `<img class="member-qr" src="${buildQrUrl(currentUser)}" alt="UČFR member QR code">`
                : `<div class="qr">▦</div>`
            }
          </div>
        </div>
      </section>

      <section class="section" id="education">
        <div class="section-head">
          <span>${x.news.toUpperCase()}</span>
          <h2>${x.news}</h2>
        </div>

        <div class="grid news">
          <article>
            <small>12. 6. 2026</small>
            <h3>
              ${
                lang === 'cs'
                  ? 'Nový vzdělávací program pro mladé rozhodčí'
                  : 'New education programme for young referees'
              }
            </h3>
            <p>
              ${
                lang === 'cs'
                  ? 'Mentoring, praktické semináře a individuální podpora.'
                  : 'Mentoring, practical seminars and individual support.'
              }
            </p>
          </article>

          <article>
            <small>4. 6. 2026</small>
            <h3>
              ${
                lang === 'cs'
                  ? 'Výzva k hlášení incidentů v soutěžích'
                  : 'Call for reporting incidents in competitions'
              }
            </h3>
            <p>
              ${
                lang === 'cs'
                  ? 'Spouštíme jednotný systém evidence a podpory.'
                  : 'We are launching a unified reporting and support system.'
              }
            </p>
          </article>

          <article>
            <small>28. 5. 2026</small>
            <h3>
              ${
                lang === 'cs'
                  ? 'Analýza odměn a cestovních náhrad'
                  : 'Analysis of referee fees and travel expenses'
              }
            </h3>
            <p>
              ${
                lang === 'cs'
                  ? 'První celorepublikové srovnání podmínek rozhodčích.'
                  : 'The first nationwide comparison of referees’ working conditions.'
              }
            </p>
          </article>
        </div>
      </section>
    </main>

    <section class="documents-section" id="documents">
      <div>
        <span class="section-label">DOCUMENTS</span>
        <h2>${lang === 'cs' ? 'Pracovní návrh stanov' : 'Draft statutes'}</h2>
        <p>
          ${
            lang === 'cs'
              ? 'Dokument upravuje cíle, členství, orgány a rozhodování spolku.'
              : 'The document governs the association’s aims, membership, bodies and decision-making.'
          }
        </p>
      </div>

      <a
        class="document-link"
        href="/documents/Stanovy_CAFR_navrh.pdf"
        target="_blank"
        rel="noopener"
      >
        📄 ${lang === 'cs' ? 'Otevřít návrh stanov' : 'Open draft statutes'}
      </a>
    </section>

    <footer id="contact">
      <div class="footer-brand">
        <img src="/assets/ucfr-logo.svg" alt="UČFR">
        <div>
          <b>Unie českých fotbalových rozhodčích, z. s.</b>
          <p>IČO: bude doplněno<br>Ochrana • Vzdělávání • Komunita • Reprezentace</p>
        </div>
      </div>

      <div>
        <b>Kontakt</b>
        <p>info@cafr.cz<br>Praha, Česká republika</p>
      </div>

      <div class="copy">© 2026 UČFR.</div>
    </footer>

    <div class="modal" id="modal">
      <div class="modal-box">
        <button class="x" id="closeModal" type="button">×</button>
        <div id="modalContent"></div>
      </div>
    </div>
  `;

  bind();
}

function bind() {
  document.querySelector('#langBtn').onclick = () => {
    lang = lang === 'cs' ? 'en' : 'cs';
    localStorage.setItem('cafr-lang', lang);
    render();
  };

  document.querySelector('#menuBtn').onclick = () => {
    document.querySelector('nav').classList.toggle('open');
  };

  document.querySelectorAll('[data-modal]').forEach((button) => {
    button.onclick = () => openModal(button.dataset.modal);
  });

  document.querySelectorAll('[data-test-mode]').forEach((button) => {
    button.onclick = () => startTest(button.dataset.testMode);
  });

  const logoutButton = document.querySelector('#logoutBtn');

  if (logoutButton) {
    logoutButton.onclick = () => {
      localStorage.removeItem('cafr-token');
      localStorage.removeItem('cafr-user');
      sessionStorage.removeItem('cafr-admin-token');
      adminToken = '';
      render();
    };
  }

  const adminPanelButton = document.querySelector('#adminPanelBtn');
  if (adminPanelButton) {
    adminPanelButton.onclick = () => {
      const token = localStorage.getItem('cafr-token');
      if (token) {
        adminToken = token;
        sessionStorage.setItem('cafr-admin-token', token);
      }
      openModal('admin');
    };
  }

  document.querySelector('#closeModal').onclick = closeModal;

  document.querySelector('#modal').onclick = (event) => {
    if (event.target.id === 'modal') {
      closeModal();
    }
  };
}

function showModal(html, wide = false) {
  document.querySelector('#modalContent').innerHTML = html;

  document
    .querySelector('.modal-box')
    .classList.toggle('test-modal-box', wide);

  document.querySelector('#modal').classList.add('show');
}

function closeModal() {
  clearInterval(timerId);
  timerId = null;
  activeTest = null;

  document.querySelector('#modal').classList.remove('show');
  document.querySelector('.modal-box').classList.remove('test-modal-box');
}

function getMemberCardNumber(user) {
  if (!user?.id) return 'UCFR-UNKNOWN';
  return getMemberCardNumber(user);
}

function getVerificationUrl(user) {
  if (!user?.id) return window.location.origin;
  return `${window.location.origin}/verify.html?member=${encodeURIComponent(user.id)}`;
}

function buildQrUrl(user) {
  const verificationUrl = getVerificationUrl(user);
  return (
    'https://api.qrserver.com/v1/create-qr-code/' +
    `?size=220x220&margin=10&data=${encodeURIComponent(verificationUrl)}`
  );
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);

  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' ') || '-'
  };
}

function openModal(type) {
  const cs = lang === 'cs';

  if (type === 'join') {
    showModal(`
      <h2>${cs ? 'Členská přihláška' : 'Membership application'}</h2>

      <form id="joinForm" class="form">
        <label>
          ${cs ? 'Jméno a příjmení' : 'Full name'}
          <input name="name" required>
        </label>

        <label>
          Email
          <input name="email" type="email" required>
        </label>

        <label>
          ${cs ? 'Heslo' : 'Password'}
          <input name="password" type="password" minlength="8" required>
        </label>

        <div class="form-row">
          <label>
            ${cs ? 'Telefon' : 'Phone'}
            <input name="phone">
          </label>

          <label>
            ${cs ? 'Kraj / okres' : 'Region / district'}
            <input name="region">
          </label>
        </div>

        <label>
          ${cs ? 'Status rozhodčího' : 'Referee status'}
          <select name="refereeStatus">
            <option>${cs ? 'Aktivní rozhodčí' : 'Active referee'}</option>
            <option>${cs ? 'Asistent rozhodčího' : 'Assistant referee'}</option>
            <option>${cs ? 'Bývalý rozhodčí' : 'Former referee'}</option>
            <option>${cs ? 'Delegát' : 'Delegate'}</option>
            <option>${cs ? 'Pozorovatel rozhodčích' : 'Referee observer'}</option>
          </select>
        </label>

        <label class="check">
          <input type="checkbox" required>
          ${
            cs
              ? 'Souhlasím se stanovami a zpracováním údajů.'
              : 'I agree with the statutes and data processing.'
          }
        </label>

        <button class="primary" type="submit">
          ${cs ? 'Odeslat přihlášku' : 'Submit application'}
        </button>

        <p class="form-message" id="joinMessage"></p>
      </form>
    `);

    document.querySelector('#joinForm').onsubmit = submitRegistration;
    return;
  }

  if (type === 'login') {
    showModal(`
      <h2>${cs ? 'Přihlášení člena' : 'Member sign in'}</h2>

      <form id="loginForm" class="form">
        <label>
          Email
          <input name="email" type="email" required>
        </label>

        <label>
          ${cs ? 'Heslo' : 'Password'}
          <input name="password" type="password" required>
        </label>

        <button class="primary" type="submit">
          ${cs ? 'Přihlásit se' : 'Sign in'}
        </button>

        <button class="text-button" id="forgotPasswordBtn" type="button">
          ${cs ? 'Zapomenuté heslo' : 'Forgot password'}
        </button>

        <p class="form-message" id="loginMessage"></p>
      </form>
    `);

    document.querySelector('#loginForm').onsubmit = submitLogin;
    document.querySelector('#forgotPasswordBtn').onclick = () => openModal('forgot-password');
    return;
  }

  if (type === 'forgot-password') {
    showModal(`
      <h2>${cs ? 'Obnovení hesla' : 'Reset password'}</h2>
      <p>${cs ? 'Zadejte e-mail použitý při registraci.' : 'Enter the email used for registration.'}</p>
      <form id="forgotPasswordForm" class="form">
        <label>Email<input name="email" type="email" required></label>
        <button class="primary" type="submit">${cs ? 'Vytvořit odkaz' : 'Create reset link'}</button>
        <p class="form-message" id="forgotPasswordMessage"></p>
      </form>
    `);

    document.querySelector('#forgotPasswordForm').onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const message = document.querySelector('#forgotPasswordMessage');
      message.textContent = cs ? 'Zpracovávám…' : 'Processing…';
      try {
        const result = await api('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: data.get('email') })
        });
        message.innerHTML = result.resetUrl
          ? `${escapeHtml(result.message)}<br><a href="${escapeHtml(result.resetUrl)}">${cs ? 'Otevřít odkaz pro změnu hesla' : 'Open password reset link'}</a>`
          : escapeHtml(result.message);
      } catch (error) {
        message.textContent = error.message;
      }
    };
    return;
  }

  if (type === 'profile') {
    const user = getCurrentUser();

    if (!user) {
      openModal('login');
      return;
    }

    const statusLabels = {
      PENDING: {
        cs: 'Čeká na schválení',
        en: 'Awaiting approval'
      },
      APPROVED: {
        cs: 'Členství schváleno',
        en: 'Membership approved'
      },
      REJECTED: {
        cs: 'Přihláška zamítnuta',
        en: 'Application rejected'
      },
      SUSPENDED: {
        cs: 'Členství pozastaveno',
        en: 'Membership suspended'
      }
    };

    const membershipStatus = user.membershipStatus || 'PENDING';
    const status = statusLabels[membershipStatus] || statusLabels.PENDING;

    showModal(
      `
        <div class="member-dashboard">
          <span class="section-label">
            ${lang === 'cs' ? 'ČLENSKÝ PROFIL' : 'MEMBER PROFILE'}
          </span>

          <h2>
            ${escapeHtml(user.firstName)}
            ${escapeHtml(user.lastName)}
          </h2>

          <div class="profile-status profile-status-${membershipStatus.toLowerCase()}">
            ${status[lang]}
          </div>

          <div class="profile-member-card">
            <div>
              <small>${lang === 'cs' ? 'DIGITÁLNÍ ČLENSKÝ PRŮKAZ' : 'DIGITAL MEMBER CARD'}</small>
              <h3>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</h3>
              <p>UCFR-${String(user.id).slice(-8).toUpperCase()}</p>
              <span>${status[lang]}</span>
            </div>
            <img class="member-qr profile-qr" src="${buildQrUrl(user)}" alt="UČFR member QR code">
          </div>

          <div class="profile-grid">
            <article>
              <small>Email</small>
              <strong>${escapeHtml(user.email)}</strong>
            </article>

            <article>
              <small>${lang === 'cs' ? 'Role' : 'Role'}</small>
              <strong>${escapeHtml(user.role || 'MEMBER')}</strong>
            </article>

            <article>
              <small>${lang === 'cs' ? 'Region' : 'Region'}</small>
              <strong>${escapeHtml(user.region || '—')}</strong>
            </article>

            <article>
              <small>
                ${lang === 'cs' ? 'Status rozhodčího' : 'Referee status'}
              </small>
              <strong>${escapeHtml(user.refereeStatus || '—')}</strong>
            </article>
          </div>

          ${
            membershipStatus === 'APPROVED'
              ? `
                <div class="member-benefits">
                  <h3>
                    ${lang === 'cs' ? 'Členská sekce' : 'Member section'}
                  </h3>

                  <div class="profile-actions">
                    <button
                      class="secondary dark"
                      data-modal="results"
                      type="button"
                    >
                      ${lang === 'cs' ? 'Moje výsledky' : 'My results'}
                    </button>

                    <button
                      class="secondary dark"
                      data-modal="incident"
                      type="button"
                    >
                      ${lang === 'cs' ? 'Nahlásit incident' : 'Report an incident'}
                    </button>

                    <a
                      class="secondary dark"
                      href="/documents/Stanovy_CAFR_navrh.pdf"
                      target="_blank"
                      rel="noopener"
                    >
                      ${lang === 'cs' ? 'Členské dokumenty' : 'Member documents'}
                    </a>
                  </div>
                </div>
              `
              : `
                <p class="muted">
                  ${
                    lang === 'cs'
                      ? 'Po schválení Výkonným výborem se zpřístupní členská sekce.'
                      : 'The member section will become available after approval by the Executive Committee.'
                  }
                </p>
              `
          }
        </div>
      `,
      true
    );

    document.querySelectorAll('[data-modal]').forEach((button) => {
      button.onclick = () => openModal(button.dataset.modal);
    });

    return;
  }

  if (type === 'incident') {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      showModal(`
        <div class="error-panel">
          <h2>${cs ? 'Přihlášení je nutné' : 'Sign in required'}</h2>
          <p>${cs ? 'Incident lze bezpečně uložit po přihlášení do členského účtu.' : 'An incident can be securely saved after signing in to a member account.'}</p>
          <button class="primary" id="incidentLoginButton" type="button">${cs ? 'Přihlásit se' : 'Sign in'}</button>
        </div>
      `);
      document.querySelector('#incidentLoginButton').onclick = () => openModal('login');
      return;
    }

    window.location.href = '/dashboard.html#incidents';
    return;
  }

  if (type === 'results') {
    loadResults();
    return;
  }

  if (type === 'admin') {
    renderAdmin();
  }
}

async function submitRegistration(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const name = splitName(String(data.get('name') || ''));
  const message = document.querySelector('#joinMessage');

  message.textContent = lang === 'cs' ? 'Odesílám…' : 'Submitting…';

  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: data.get('email'),
        password: data.get('password'),
        firstName: name.firstName,
        lastName: name.lastName,
        phone: data.get('phone'),
        region: data.get('region'),
        refereeStatus: data.get('refereeStatus'),
        language: lang
      })
    });

    message.textContent =
      lang === 'cs'
        ? 'Přihláška byla odeslána. Čeká na schválení.'
        : 'Application submitted and awaiting approval.';

    form.reset();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function submitLogin(event) {
  event.preventDefault();

  const data = new FormData(event.currentTarget);
  const message = document.querySelector('#loginMessage');

  message.textContent =
    lang === 'cs'
      ? 'Přihlašuji…'
      : 'Signing in…';

  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: data.get('email'),
        password: data.get('password')
      })
    });

    localStorage.setItem('cafr-token', result.token);
    localStorage.setItem('cafr-user', JSON.stringify(result.user));

    message.textContent =
      lang === 'cs'
        ? `Přihlášen: ${result.user.firstName} ${result.user.lastName}`
        : `Signed in: ${result.user.firstName} ${result.user.lastName}`;

    setTimeout(() => {
      closeModal();

      if (['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(result.user.role)) {
        adminToken = result.token;
        sessionStorage.setItem('cafr-admin-token', result.token);
        render();
        openModal('admin');
        return;
      }

      window.location.href = '/dashboard.html';
    }, 400);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function startTest(mode) {
  showModal(
    `
      <div class="loading-state">
        ${lang === 'cs' ? 'Načítám otázky…' : 'Loading questions…'}
      </div>
    `,
    true
  );

  try {
    const questions = await api(`/api/questions?lang=${lang}&count=10`);

    activeTest = {
      mode,
      questions,
      index: 0,
      answers: Array(questions.length).fill(null),
      seconds: mode === 'exam' ? 600 : null,
      startedAt: Date.now()
    };

    renderQuestion();

    if (mode === 'exam') {
      timerId = setInterval(() => {
        activeTest.seconds -= 1;

        const timer = document.querySelector('#testTimer');

        if (timer) {
          timer.textContent = formatTime(activeTest.seconds);
        }

        if (activeTest.seconds <= 0) {
          finishTest();
        }
      }, 1000);
    }
  } catch (error) {
    showModal(
      `
        <div class="error-panel">
          <h2>API error</h2>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `,
      true
    );
  }
}

function renderQuestion() {
  const question = activeTest.questions[activeTest.index];
  const text = question[lang] || question;

  showModal(
    `
      <div class="test-shell">
        <div class="test-top">
          <b>${activeTest.index + 1} / ${activeTest.questions.length}</b>

          ${
            activeTest.mode === 'exam'
              ? `<span id="testTimer">${formatTime(activeTest.seconds)}</span>`
              : ''
          }
        </div>

        <h2>${escapeHtml(text.q)}</h2>

        <div class="test-answers">
          ${text.a
            .map(
              (answer, index) => `
                <button
                  class="answer-button ${
                    activeTest.answers[activeTest.index] === index
                      ? 'selected'
                      : ''
                  }"
                  data-answer="${index}"
                  type="button"
                >
                  ${String.fromCharCode(65 + index)}.
                  ${escapeHtml(answer)}
                </button>
              `
            )
            .join('')}
        </div>

        <div class="test-actions">
          <button
            class="secondary dark"
            id="prevQuestion"
            type="button"
            ${activeTest.index === 0 ? 'disabled' : ''}
          >
            ←
          </button>

          <button class="primary" id="nextQuestion" type="button">
            ${
              activeTest.index === activeTest.questions.length - 1
                ? lang === 'cs'
                  ? 'Vyhodnotit'
                  : 'Finish'
                : lang === 'cs'
                  ? 'Další'
                  : 'Next'
            }
          </button>
        </div>
      </div>
    `,
    true
  );

  document.querySelectorAll('[data-answer]').forEach((button) => {
    button.onclick = () => {
      activeTest.answers[activeTest.index] = Number(button.dataset.answer);
      renderQuestion();
    };
  });

  document.querySelector('#prevQuestion').onclick = () => {
    activeTest.index -= 1;
    renderQuestion();
  };

  document.querySelector('#nextQuestion').onclick = () => {
    if (activeTest.index === activeTest.questions.length - 1) {
      finishTest();
    } else {
      activeTest.index += 1;
      renderQuestion();
    }
  };
}

async function finishTest() {
  clearInterval(timerId);

  const duration = Math.round(
    (Date.now() - activeTest.startedAt) / 1000
  );

  try {
    const user = getCurrentUser();

    const result = await api('/api/attempts', {
      method: 'POST',
      body: JSON.stringify({
        mode: activeTest.mode,
        lang,
        answers: activeTest.answers,
        questionIds: activeTest.questions.map((question) => question.id),
        duration,
        userId: user?.id
      })
    });

    const attempt = result.attempt;

    showModal(
      `
        <div class="test-result">
          <span class="section-label">RESULT</span>

          <div class="score-ring">
            <strong>${attempt.percent}%</strong>
            <span>${attempt.correct} / ${attempt.total}</span>
          </div>

          <h2>${lang === 'cs' ? 'Test dokončen' : 'Test completed'}</h2>

          <button class="primary" data-modal="results" type="button">
            ${lang === 'cs' ? 'Moje výsledky' : 'My results'}
          </button>
        </div>
      `,
      true
    );

    document.querySelector('[data-modal="results"]').onclick = loadResults;
  } catch (error) {
    showModal(
      `
        <div class="error-panel">
          <h2>API error</h2>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `,
      true
    );
  }
}

async function loadResults() {
  showModal(
    `
      <div class="loading-state">
        ${lang === 'cs' ? 'Načítám výsledky…' : 'Loading results…'}
      </div>
    `,
    true
  );

  try {
    const user = getCurrentUser();

    if (!user?.id) {
      throw new Error(
        lang === 'cs'
          ? 'Nejdříve se přihlaste.'
          : 'Please sign in first.'
      );
    }

    const attempts = await api(
      `/api/results/${encodeURIComponent(user.id)}`
    );

    showModal(
      `
        <h2>${lang === 'cs' ? 'Historie testů' : 'Test history'}</h2>

        ${
          attempts.length
            ? `
              <div class="results-table">
                ${attempts
                  .map(
                    (attempt) => `
                      <div class="results-row">
                        <span>${new Date(attempt.createdAt).toLocaleDateString()}</span>
                        <span>${attempt.mode}</span>
                        <span><b>${attempt.percent}%</b></span>
                        <span>${formatTime(attempt.duration)}</span>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            `
            : `
              <p>
                ${lang === 'cs' ? 'Zatím žádné výsledky.' : 'No results yet.'}
              </p>
            `
        }
      `,
      true
    );
  } catch (error) {
    showModal(
      `
        <div class="error-panel">
          <h2>
            ${
              lang === 'cs'
                ? 'Výsledky nelze načíst'
                : 'Cannot load results'
            }
          </h2>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `,
      true
    );
  }
}


function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function renderAdmin() {
  if (!adminToken) {
    showModal(
      `
        <h2>${lang === 'cs' ? 'Administrace' : 'Administration'}</h2>

        <form id="adminLogin" class="form admin-login">
          <label>
            Email
            <input
              name="email"
              type="email"
              value="admin@cafr.cz"
              required
            >
          </label>

          <label>
            ${lang === 'cs' ? 'Heslo' : 'Password'}
            <input name="password" type="password" required>
          </label>

          <button class="primary" type="submit">
            ${lang === 'cs' ? 'Přihlásit' : 'Sign in'}
          </button>

          <p id="adminMessage"></p>
        </form>
      `,
      true
    );

    document.querySelector('#adminLogin').onsubmit = async (event) => {
      event.preventDefault();

      const data = new FormData(event.currentTarget);

      try {
        const result = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: data.get('email'),
            password: data.get('password')
          })
        });

        if (!['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(result.user.role)) {
          throw new Error('Forbidden');
        }

        adminToken = result.token;
        sessionStorage.setItem('cafr-admin-token', adminToken);
        renderAdmin();
      } catch (error) {
        document.querySelector('#adminMessage').textContent = error.message;
      }
    };

    return;
  }

  showModal(`<div class="loading-state">Loading…</div>`, true);

  try {
    const headers = {
      Authorization: `Bearer ${adminToken}`
    };

    const [stats, questions, users, incidents, seminars, fees, legalRequests, documents] = await Promise.all([
      api('/api/admin/stats', { headers }),
      api('/api/admin/questions', { headers }),
      api('/api/admin/users', { headers }),
      api('/api/admin/incidents', { headers }),
      api('/api/admin/seminars', { headers }),
      api('/api/admin/fees', { headers }),
      api('/api/admin/legal-requests', { headers }),
      api('/api/admin/documents', { headers })
    ]);

    const pendingCount = users.filter(
      (user) => user.membershipStatus === 'PENDING'
    ).length;

    const approvedCount = users.filter(
      (user) => user.membershipStatus === 'APPROVED'
    ).length;

    showModal(
      `
        <div class="admin-shell">
          <div class="admin-head">
            <div>
              <span class="section-label">ADMIN</span>
              <h2>
                ${lang === 'cs' ? 'Správa UČFR' : 'UČFR administration'}
              </h2>
            </div>

            <button id="adminLogout" class="danger-link" type="button">
              ${lang === 'cs' ? 'Odhlásit' : 'Sign out'}
            </button>
          </div>

          <div class="admin-stats admin-stats-four">
            <article>
              <b>${users.length}</b>
              <span>${lang === 'cs' ? 'registrovaných osob' : 'registered users'}</span>
            </article>

            <article>
              <b>${pendingCount}</b>
              <span>${lang === 'cs' ? 'čeká na schválení' : 'awaiting approval'}</span>
            </article>

            <article>
              <b>${approvedCount}</b>
              <span>${lang === 'cs' ? 'schválených členů' : 'approved members'}</span>
            </article>

            <article>
              <b>${stats.activeQuestions}</b>
              <span>${lang === 'cs' ? 'aktivních otázek' : 'active questions'}</span>
            </article>
          </div>

          <section class="admin-panel-section">
            <div class="admin-section-head">
              <div>
                <span class="section-label">
                  ${lang === 'cs' ? 'ČLENOVÉ' : 'MEMBERS'}
                </span>
                <h3>
                  ${lang === 'cs' ? 'Registrovaní členové' : 'Registered members'}
                </h3>
              </div>

              <span class="admin-count">${users.length}</span>
            </div>

            <div class="admin-member-list">
              ${users.length
                ? users
                    .map(
                      (user) => `
                        <article class="admin-member-card">
                          <div class="admin-member-main">
                            <div class="admin-member-avatar">
                              ${escapeHtml((user.firstName || '?').charAt(0).toUpperCase())}
                              ${escapeHtml((user.lastName || '?').charAt(0).toUpperCase())}
                            </div>

                            <div>
                              <h4>
                                ${escapeHtml(user.firstName)}
                                ${escapeHtml(user.lastName)}
                              </h4>

                              <p>${escapeHtml(user.email)}</p>

                              <div class="admin-member-meta">
                                <span>${escapeHtml(user.region || '—')}</span>
                                <span>${escapeHtml(user.refereeStatus || '—')}</span>
                                <span>${new Date(user.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <div class="admin-member-controls">
                            <label>
                              ${lang === 'cs' ? 'Členství' : 'Membership'}
                              <select data-user-status="${user.id}">
                                ${['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']
                                  .map(
                                    (status) => `
                                      <option
                                        value="${status}"
                                        ${user.membershipStatus === status ? 'selected' : ''}
                                      >
                                        ${status}
                                      </option>
                                    `
                                  )
                                  .join('')}
                              </select>
                            </label>

                            <label>
                              ${lang === 'cs' ? 'Role' : 'Role'}
                              <select data-user-role="${user.id}">
                                ${['MEMBER', 'LECTURER', 'QUESTION_EDITOR', 'ADMIN', 'BOARD']
                                  .map(
                                    (role) => `
                                      <option
                                        value="${role}"
                                        ${user.role === role ? 'selected' : ''}
                                      >
                                        ${role}
                                      </option>
                                    `
                                  )
                                  .join('')}
                              </select>
                            </label>
                          </div>
                        </article>
                      `
                    )
                    .join('')
                : `
                    <div class="empty-results">
                      <h3>${lang === 'cs' ? 'Žádní uživatelé' : 'No users'}</h3>
                    </div>
                  `}
            </div>
          </section>

          <section class="admin-panel-section">
            <div class="admin-section-head">
              <div>
                <span class="section-label">INCIDENTS</span>
                <h3>${lang === 'cs' ? 'Nahlášené incidenty' : 'Reported incidents'}</h3>
              </div>
              <span class="admin-count">${incidents.length}</span>
            </div>

            <div class="admin-incident-filters">
              <label>${lang === 'cs' ? 'Filtrovat stav' : 'Filter status'}
                <select id="incidentStatusFilter">
                  <option value="ALL">${lang === 'cs' ? 'Všechny' : 'All'}</option>
                  ${['NEW','IN_REVIEW','CONTACTED','RESOLVED','CLOSED'].map((status) => `<option value="${status}">${status}</option>`).join('')}
                </select>
              </label>
              <label>${lang === 'cs' ? 'Filtrovat prioritu' : 'Filter priority'}
                <select id="incidentUrgencyFilter">
                  <option value="ALL">${lang === 'cs' ? 'Všechny' : 'All'}</option>
                  ${['NORMAL','HIGH','CRITICAL'].map((urgency) => `<option value="${urgency}">${urgency}</option>`).join('')}
                </select>
              </label>
            </div>

            <div class="admin-member-list" id="adminIncidentList">
              ${incidents.length ? incidents.map((incident) => `
                <article class="admin-member-card admin-incident-card" data-status="${incident.status}" data-urgency="${incident.urgency}">
                  <div class="admin-member-main">
                    <div class="admin-member-avatar">!</div>
                    <div>
                      <h4>${escapeHtml(incident.user.firstName)} ${escapeHtml(incident.user.lastName)}</h4>
                      <p>${escapeHtml(incident.matchInfo)} · ${new Date(incident.incidentDate).toLocaleDateString()}</p>
                      <div class="admin-member-meta">
                        <span>${escapeHtml(incident.incidentType)}</span>
                        <span>${escapeHtml(incident.urgency)}</span>
                        <span>${escapeHtml(incident.user.email)}</span>
                        ${incident.user.phone ? `<span>${escapeHtml(incident.user.phone)}</span>` : ''}
                      </div>
                      <p>${escapeHtml(incident.description)}</p>
                      ${renderAttachments(incident.attachments)}
                      ${incident.events?.length ? `
                        <details class="incident-timeline">
                          <summary>${lang === 'cs' ? 'Historie zpracování' : 'Processing history'} (${incident.events.length})</summary>
                          ${incident.events.map((event) => `
                            <div class="incident-timeline-item">
                              <span>${new Date(event.createdAt).toLocaleString()}</span>
                              <strong>${escapeHtml(event.type)}</strong>
                              ${event.oldStatus || event.newStatus ? `<small>${escapeHtml(event.oldStatus || '—')} → ${escapeHtml(event.newStatus || '—')}</small>` : ''}
                              ${event.message ? `<p>${escapeHtml(event.message)}</p>` : ''}
                            </div>
                          `).join('')}
                        </details>
                      ` : ''}
                    </div>
                  </div>
                  <div class="admin-member-controls incident-admin-controls">
                    <label>
                      ${lang === 'cs' ? 'Stav' : 'Status'}
                      <select data-incident-status="${incident.id}">
                        ${['NEW','IN_REVIEW','CONTACTED','RESOLVED','CLOSED'].map((status) => `
                          <option value="${status}" ${incident.status === status ? 'selected' : ''}>${status}</option>
                        `).join('')}
                      </select>
                    </label>
                    <label>
                      ${lang === 'cs' ? 'Odpověď / poznámka pro člena' : 'Reply / note for member'}
                      <textarea data-incident-note="${incident.id}" rows="4">${escapeHtml(incident.adminNote || '')}</textarea>
                    </label>
                    <button class="secondary dark" data-save-incident="${incident.id}" type="button">
                      ${lang === 'cs' ? 'Uložit změny' : 'Save changes'}
                    </button>
                  </div>
                </article>
              `).join('') : `<div class="empty-results"><h3>${lang === 'cs' ? 'Žádné incidenty' : 'No incidents'}</h3></div>`}
            </div>
          </section>



          <section class="admin-panel-section">
            <div class="admin-section-head">
              <div>
                <span class="section-label">LEGAL</span>
                <h3>${lang === 'cs' ? 'Právní dotazy členů' : 'Member legal requests'}</h3>
              </div>
              <span class="admin-count">${legalRequests.length}</span>
            </div>

            <div class="admin-member-list">
              ${legalRequests.length ? legalRequests.map((item) => `
                <article class="admin-member-card">
                  <div class="admin-member-main">
                    <div class="admin-member-avatar">§</div>
                    <div>
                      <h4>${escapeHtml(item.subject)}</h4>
                      <p>${escapeHtml(item.user.firstName)} ${escapeHtml(item.user.lastName)} · ${escapeHtml(item.user.email)}</p>
                      <div class="admin-member-meta">
                        <span>${escapeHtml(item.category)}</span>
                        <span>${escapeHtml(item.urgency)}</span>
                        <span>${new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <p>${escapeHtml(item.description)}</p>
                      ${renderAttachments(item.attachments)}
                    </div>
                  </div>
                  <div class="admin-member-controls incident-admin-controls">
                    <label>Stav
                      <select data-legal-status="${item.id}">
                        ${['NEW','IN_REVIEW','NEEDS_INFO','ANSWERED','CLOSED'].map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}
                      </select>
                    </label>
                    <label>${lang === 'cs' ? 'Odpověď členovi' : 'Reply to member'}
                      <textarea data-legal-reply="${item.id}" rows="5">${escapeHtml(item.adminReply || '')}</textarea>
                    </label>
                    <button class="secondary dark" data-save-legal="${item.id}" type="button">
                      ${lang === 'cs' ? 'Uložit odpověď' : 'Save reply'}
                    </button>
                  </div>
                </article>
              `).join('') : `<p>${lang === 'cs' ? 'Žádné právní dotazy.' : 'No legal requests.'}</p>`}
            </div>
          </section>


          <section class="admin-panel-section">
            <div class="admin-section-head"><div><span class="section-label">SEMINARS</span><h3>${lang === 'cs' ? 'Semináře a registrace' : 'Seminars and registrations'}</h3></div><span class="admin-count">${seminars.length}</span></div>
            <form id="seminarForm" class="form admin-seminar-form">
              <div class="form-row"><label>Název CZ<input name="titleCs" required></label><label>Title EN<input name="titleEn" required></label></div>
              <div class="form-row"><label>Místo<input name="location" required></label><label>Kapacita<input name="capacity" type="number" min="1"></label></div>
              <div class="form-row"><label>Začátek<input name="startsAt" type="datetime-local" required></label><label>Konec<input name="endsAt" type="datetime-local" required></label></div>
              <label>Popis CZ<textarea name="descriptionCs" rows="3"></textarea></label>
              <label>Description EN<textarea name="descriptionEn" rows="3"></textarea></label>
              <label>Stav<select name="status"><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option></select></label>
              <button class="primary" type="submit">${lang === 'cs' ? 'Vytvořit seminář' : 'Create seminar'}</button><p id="seminarMessage"></p>
            </form>
            <div class="admin-member-list">
              ${seminars.length ? seminars.map((item) => `<article class="admin-member-card"><div class="admin-member-main"><div class="admin-member-avatar">S</div><div><h4>${escapeHtml(item.titleCs)}</h4><p>${new Date(item.startsAt).toLocaleString()} · ${escapeHtml(item.location)}</p><div class="admin-member-meta"><span>${item.status}</span><span>${item.registrationCount}${item.capacity ? ` / ${item.capacity}` : ''} registrací</span></div>${item.registrations?.length ? `<details><summary>Registrovaní (${item.registrations.filter((r) => r.status === 'REGISTERED').length})</summary>${item.registrations.filter((r) => r.status === 'REGISTERED').map((r) => `<p>${escapeHtml(r.user.firstName)} ${escapeHtml(r.user.lastName)} · ${escapeHtml(r.user.email)}</p>`).join('')}</details>` : ''}</div></div><div class="admin-member-controls"><label>Stav<select data-seminar-status="${item.id}">${['DRAFT','PUBLISHED','CANCELLED','COMPLETED'].map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label><button class="danger-link" data-delete-seminar="${item.id}" type="button">Smazat</button></div></article>`).join('') : '<p>Žádné semináře.</p>'}
            </div>
          </section>

          <section class="admin-panel-section">
            <div class="admin-section-head">
              <div><span class="section-label">FEES</span><h3>${lang === 'cs' ? 'Členské příspěvky' : 'Membership fees'}</h3></div>
              <span class="admin-count">${fees.length}</span>
            </div>

            <form id="feeGenerateForm" class="form admin-seminar-form">
              <div class="form-row">
                <label>${lang === 'cs' ? 'Rok' : 'Year'}<input name="year" type="number" min="2020" max="2100" value="${new Date().getFullYear()}" required></label>
                <label>${lang === 'cs' ? 'Částka Kč' : 'Amount CZK'}<input name="amountCzk" type="number" min="0" step="1" required></label>
              </div>
              <label>${lang === 'cs' ? 'Datum splatnosti' : 'Due date'}<input name="dueDate" type="date" required></label>
              <button class="primary" type="submit">${lang === 'cs' ? 'Vygenerovat pro schválené členy' : 'Generate for approved members'}</button>
              <p id="feeGenerateMessage"></p>
            </form>

            <div class="admin-member-list">
              ${fees.length ? fees.map((fee) => `
                <article class="admin-member-card">
                  <div class="admin-member-main">
                    <div class="admin-member-avatar">Kč</div>
                    <div>
                      <h4>${escapeHtml(fee.user.firstName)} ${escapeHtml(fee.user.lastName)}</h4>
                      <p>${escapeHtml(fee.user.email)}</p>
                      <div class="admin-member-meta">
                        <span>${fee.year}</span>
                        <span>${Number(fee.amountCzk).toLocaleString('cs-CZ')} Kč</span>
                        <span>${new Date(fee.dueDate).toLocaleDateString('cs-CZ')}</span>
                      </div>
                    </div>
                  </div>
                  <div class="admin-member-controls">
                    <label>${lang === 'cs' ? 'Stav' : 'Status'}
                      <select data-fee-status="${fee.id}">
                        ${['PENDING','PAID','OVERDUE','WAIVED'].map((status) => `<option value="${status}" ${fee.status === status ? 'selected' : ''}>${status}</option>`).join('')}
                      </select>
                    </label>
                    <label>${lang === 'cs' ? 'Poznámka' : 'Note'}<textarea rows="3" data-fee-note="${fee.id}">${escapeHtml(fee.note || '')}</textarea></label>
                    <button class="secondary dark" data-save-fee="${fee.id}" type="button">${lang === 'cs' ? 'Uložit' : 'Save'}</button>
                  </div>
                </article>
              `).join('') : `<p>${lang === 'cs' ? 'Zatím nejsou vytvořeny žádné příspěvky.' : 'No fees created yet.'}</p>`}
            </div>
          </section>

          <section class="admin-panel-section">
            <div class="admin-section-head">
              <div>
                <span class="section-label">DOCUMENTS</span>
                <h3>${lang === 'cs' ? 'Knihovna dokumentů' : 'Document library'}</h3>
              </div>
              <span class="admin-count">${documents.length}</span>
            </div>

            <form id="documentForm" class="form admin-seminar-form">
              <div class="form-row">
                <label>Název CZ<input name="titleCs" required></label>
                <label>Title EN<input name="titleEn" required></label>
              </div>
              <label>${lang === 'cs' ? 'Nahrát soubor PDF/DOCX/obrázek' : 'Upload PDF/DOCX/image file'}<input name="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>
              <label>${lang === 'cs' ? 'Nebo URL dokumentu' : 'Or document URL'}<input name="url" placeholder="/documents/Stanovy_CAFR_navrh.pdf"></label>
              <div class="form-row">
                <label>Kategorie<input name="category" value="GENERAL"></label>
                <label>Viditelnost<select name="visibility"><option value="APPROVED_MEMBERS">APPROVED_MEMBERS</option><option value="MEMBERS">MEMBERS</option><option value="PUBLIC">PUBLIC</option><option value="ADMIN_ONLY">ADMIN_ONLY</option></select></label>
              </div>
              <label>Popis CZ<textarea name="descriptionCs" rows="2"></textarea></label>
              <label>Description EN<textarea name="descriptionEn" rows="2"></textarea></label>
              <button class="primary" type="submit">${lang === 'cs' ? 'Přidat / nahrát dokument' : 'Add / upload document'}</button><p id="documentMessage"></p>
            </form>

            <div class="admin-member-list">
              ${documents.length ? documents.map((document) => `
                <article class="admin-member-card">
                  <div class="admin-member-main">
                    <div class="admin-member-avatar">📄</div>
                    <div>
                      <h4>${escapeHtml(document.titleCs)}</h4>
                      <p>${escapeHtml(document.url)}</p>
                      <div class="admin-member-meta"><span>${escapeHtml(document.category)}</span><span>${document.visibility}</span><span>${document.status}</span></div>
                    </div>
                  </div>
                  <div class="admin-member-controls">
                    <label>Stav<select data-document-status="${document.id}">${['DRAFT','PUBLISHED','ARCHIVED'].map((status) => `<option value="${status}" ${document.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
                    <label>Viditelnost<select data-document-visibility="${document.id}">${['PUBLIC','MEMBERS','APPROVED_MEMBERS','ADMIN_ONLY'].map((visibility) => `<option value="${visibility}" ${document.visibility === visibility ? 'selected' : ''}>${visibility}</option>`).join('')}</select></label>
                    <button class="danger-link" data-archive-document="${document.id}" type="button">Archivovat</button>
                  </div>
                </article>
              `).join('') : `<p>${lang === 'cs' ? 'Zatím žádné dokumenty.' : 'No documents yet.'}</p>`}
            </div>
          </section>

          <section class="admin-panel-section">
            <div class="admin-section-head">
              <div>
                <span class="section-label">
                  ${lang === 'cs' ? 'TESTY' : 'TESTS'}
                </span>
                <h3>
                  ${lang === 'cs' ? 'Správa testových otázek' : 'Test question management'}
                </h3>
              </div>

              <span class="admin-count">${questions.length}</span>
            </div>

            <div class="admin-question-list">
              ${questions
                .map(
                  (question) => `
                    <article class="admin-question ${question.active ? '' : 'inactive'}">
                      <div>
                        <span>${escapeHtml(question.category)}</span>
                        <h3>${escapeHtml(question.cs.q)}</h3>
                      </div>

                      <button
                        class="secondary dark"
                        data-toggle="${question.id}"
                        data-active="${question.active}"
                        type="button"
                      >
                        ${
                          question.active
                            ? lang === 'cs'
                              ? 'Deaktivovat'
                              : 'Deactivate'
                            : lang === 'cs'
                              ? 'Aktivovat'
                              : 'Activate'
                        }
                      </button>
                    </article>
                  `
                )
                .join('')}
            </div>
          </section>
        </div>
      `,
      true
    );

    document.querySelector('#adminLogout').onclick = () => {
      adminToken = '';
      sessionStorage.removeItem('cafr-admin-token');
      renderAdmin();
    };


    const applyIncidentFilters = () => {
      const status = document.querySelector('#incidentStatusFilter')?.value || 'ALL';
      const urgency = document.querySelector('#incidentUrgencyFilter')?.value || 'ALL';
      document.querySelectorAll('.admin-incident-card').forEach((card) => {
        const visible = (status === 'ALL' || card.dataset.status === status) && (urgency === 'ALL' || card.dataset.urgency === urgency);
        card.style.display = visible ? '' : 'none';
      });
    };

    document.querySelector('#incidentStatusFilter')?.addEventListener('change', applyIncidentFilters);
    document.querySelector('#incidentUrgencyFilter')?.addEventListener('change', applyIncidentFilters);

    document.querySelectorAll('[data-save-incident]').forEach((button) => {
      button.onclick = async () => {
        const id = button.dataset.saveIncident;
        const status = document.querySelector(`[data-incident-status="${id}"]`)?.value;
        const adminNote = document.querySelector(`[data-incident-note="${id}"]`)?.value || '';
        button.disabled = true;
        try {
          await api(`/api/admin/incidents/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status, adminNote })
          });
          renderAdmin();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      };
    });




    document.querySelector('#documentForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const message = document.querySelector('#documentMessage');
      const file = data.get('file');
      message.textContent = lang === 'cs' ? 'Ukládám…' : 'Saving…';
      try {
        const payload = Object.fromEntries(data.entries());
        delete payload.file;

        if (file && file.name && file.size > 0) {
          if (file.size > 8 * 1024 * 1024) {
            throw new Error(lang === 'cs' ? 'Soubor je příliš velký. Maximum je 8 MB.' : 'The file is too large. Maximum is 8 MB.');
          }
          message.textContent = lang === 'cs' ? 'Nahrávám soubor…' : 'Uploading file…';
          payload.fileName = file.name;
          payload.fileData = await readFileAsDataUrl(file);
          await api('/api/admin/documents/upload', { method: 'POST', headers, body: JSON.stringify(payload) });
        } else {
          if (!String(payload.url || '').trim()) {
            throw new Error(lang === 'cs' ? 'Nahrajte soubor nebo zadejte URL dokumentu.' : 'Upload a file or enter a document URL.');
          }
          await api('/api/admin/documents', { method: 'POST', headers, body: JSON.stringify(payload) });
        }

        renderAdmin();
      } catch (error) {
        message.textContent = error.message;
      }
    });

    document.querySelectorAll('[data-document-status]').forEach((select) => {
      select.onchange = async () => {
        try {
          await api(`/api/admin/documents/${select.dataset.documentStatus}`, { method: 'PATCH', headers, body: JSON.stringify({ status: select.value }) });
          renderAdmin();
        } catch (error) { alert(error.message); }
      };
    });

    document.querySelectorAll('[data-document-visibility]').forEach((select) => {
      select.onchange = async () => {
        try {
          await api(`/api/admin/documents/${select.dataset.documentVisibility}`, { method: 'PATCH', headers, body: JSON.stringify({ visibility: select.value }) });
          renderAdmin();
        } catch (error) { alert(error.message); }
      };
    });

    document.querySelectorAll('[data-archive-document]').forEach((button) => {
      button.onclick = async () => {
        if (!confirm('Archivovat dokument?')) return;
        try {
          await api(`/api/admin/documents/${button.dataset.archiveDocument}`, { method: 'DELETE', headers });
          renderAdmin();
        } catch (error) { alert(error.message); }
      };
    });

    document.querySelector('#feeGenerateForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const message = document.querySelector('#feeGenerateMessage');
      message.textContent = lang === 'cs' ? 'Generuji…' : 'Generating…';
      try {
        const result = await api('/api/admin/fees/generate', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            year: Number(data.get('year')),
            amountCzk: Number(data.get('amountCzk')),
            dueDate: data.get('dueDate'),
          }),
        });
        message.textContent = `${lang === 'cs' ? 'Vytvořeno nebo aktualizováno' : 'Created or updated'}: ${result.createdOrUpdated}`;
        setTimeout(renderAdmin, 500);
      } catch (error) {
        message.textContent = error.message;
      }
    });

    document.querySelectorAll('[data-save-fee]').forEach((button) => {
      button.onclick = async () => {
        const id = button.dataset.saveFee;
        const status = document.querySelector(`[data-fee-status="${id}"]`)?.value;
        const note = document.querySelector(`[data-fee-note="${id}"]`)?.value || '';
        button.disabled = true;
        try {
          await api(`/api/admin/fees/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status, note }),
          });
          renderAdmin();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      };
    });

    document.querySelector('#seminarForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const message = document.querySelector('#seminarMessage');
      message.textContent = 'Ukládám…';
      try {
        await api('/api/admin/seminars', { method: 'POST', headers, body: JSON.stringify(Object.fromEntries(data.entries())) });
        renderAdmin();
      } catch (error) { message.textContent = error.message; }
    });
    document.querySelectorAll('[data-seminar-status]').forEach((select) => {
      select.onchange = async () => { try { await api(`/api/admin/seminars/${select.dataset.seminarStatus}`, { method: 'PATCH', headers, body: JSON.stringify({ status: select.value }) }); renderAdmin(); } catch (error) { alert(error.message); } };
    });
    document.querySelectorAll('[data-delete-seminar]').forEach((button) => {
      button.onclick = async () => { if (!confirm('Smazat seminář?')) return; try { await api(`/api/admin/seminars/${button.dataset.deleteSeminar}`, { method: 'DELETE', headers }); renderAdmin(); } catch (error) { alert(error.message); } };
    });


    document.querySelectorAll('[data-save-legal]').forEach((button) => {
      button.onclick = async () => {
        const id = button.dataset.saveLegal;
        const status = document.querySelector(`[data-legal-status="${id}"]`)?.value;
        const adminReply = document.querySelector(`[data-legal-reply="${id}"]`)?.value || '';
        button.disabled = true;
        try {
          await api(`/api/admin/legal-requests/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status, adminReply }),
          });
          renderAdmin();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      };
    });

    document.querySelectorAll('[data-user-status]').forEach((select) => {
      select.onchange = async () => {
        select.disabled = true;

        try {
          await api(`/api/admin/users/${select.dataset.userStatus}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              membershipStatus: select.value
            })
          });

          renderAdmin();
        } catch (error) {
          alert(error.message);
          select.disabled = false;
        }
      };
    });

    document.querySelectorAll('[data-user-role]').forEach((select) => {
      select.onchange = async () => {
        select.disabled = true;

        try {
          await api(`/api/admin/users/${select.dataset.userRole}/role`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              role: select.value
            })
          });

          renderAdmin();
        } catch (error) {
          alert(error.message);
          select.disabled = false;
        }
      };
    });

    document.querySelectorAll('[data-toggle]').forEach((button) => {
      button.onclick = async () => {
        await api(`/api/admin/questions/${button.dataset.toggle}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            active: button.dataset.active !== 'true'
          })
        });

        renderAdmin();
      };
    });
  } catch (error) {
    adminToken = '';
    sessionStorage.removeItem('cafr-admin-token');

    showModal(
      `
        <div class="error-panel">
          <h2>Admin API error</h2>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `,
      true
    );
  }
}

function formatTime(seconds) {
  const number = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(number / 60);
  const remainingSeconds = number % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

render();

const requestedAdminPanel = new URLSearchParams(window.location.search).get('admin') === '1';
const signedInUser = getCurrentUser();
if (requestedAdminPanel && signedInUser && ['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(signedInUser.role)) {
  const token = localStorage.getItem('cafr-token');
  if (token) {
    adminToken = token;
    sessionStorage.setItem('cafr-admin-token', token);
    window.setTimeout(() => openModal('admin'), 0);
  }
}
