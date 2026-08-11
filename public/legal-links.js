(() => {
  'use strict';

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'cs';
  }

  function ensureStyles() {
    if (document.getElementById('ucfrLegalLinksStyle')) return;
    const style = document.createElement('style');
    style.id = 'ucfrLegalLinksStyle';
    style.textContent = `
      .ucfr-legal-links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        align-items: center;
        margin-top: 14px;
        font-size: 13px;
      }
      .ucfr-legal-links a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      #joinForm .ucfr-privacy-inline-link {
        font-weight: 800;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFooterLinks() {
    const footer = document.querySelector('footer#contact');
    if (!footer) return;

    const lang = language();
    let nav = footer.querySelector('.ucfr-legal-links');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'ucfr-legal-links';
      nav.setAttribute('aria-label', lang === 'en' ? 'Legal information' : 'Právní informace');
      const copy = footer.querySelector('.copy');
      if (copy) copy.insertAdjacentElement('beforebegin', nav);
      else footer.appendChild(nav);
    }

    const signature = lang;
    if (nav.dataset.language === signature) return;
    nav.dataset.language = signature;
    nav.innerHTML = lang === 'en'
      ? '<a href="/privacy.html">Privacy</a><a href="/cookies.html">Cookies</a><a href="/terms.html">Terms of use</a>'
      : '<a href="/privacy.html">Ochrana osobních údajů</a><a href="/cookies.html">Cookies</a><a href="/terms.html">Podmínky užití</a>';
  }

  function linkPrivacyNotice() {
    const checkbox = document.querySelector('#joinForm input[name="privacyNoticeAcknowledged"]');
    const label = checkbox?.closest('label');
    const text = label?.querySelector('span');
    if (!text || text.querySelector('.ucfr-privacy-inline-link')) return;

    const lang = language();
    text.innerHTML = lang === 'en'
      ? 'I acknowledge the <a class="ucfr-privacy-inline-link" href="/privacy.html" target="_blank" rel="noopener">information on personal data processing</a> by the Union of Czech Football Referees for maintaining membership records, verifying membership requirements and membership-related communication.'
      : 'Beru na vědomí <a class="ucfr-privacy-inline-link" href="/privacy.html" target="_blank" rel="noopener">informace o zpracování osobních údajů</a> Unií českých fotbalových rozhodčích, z. s., pro účely vedení členské evidence, ověření podmínek členství a komunikace související s členstvím.';
  }

  function apply() {
    ensureStyles();
    ensureFooterLinks();
    linkPrivacyNotice();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#langBtn')) {
      window.setTimeout(apply, 0);
      window.setTimeout(apply, 120);
    }
  });

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      apply();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
