(() => {
  'use strict';

  const FACEBOOK_URL = 'https://www.facebook.com/share/1Bi9WVrVAx/?mibextid=wwXIfr';
  const INSTAGRAM_URL = 'https://www.instagram.com/ucfr_official?igsh=MW9hOWl6cDVuZW91cw==';

  function socialMarkup() {
    const isCzech = document.documentElement.lang !== 'en';
    const heading = isCzech ? 'Sledujte nás' : 'Follow us';

    return `
      <b>${heading}</b>
      <div class="ucfr-social-links">
        <a
          class="ucfr-social-link ucfr-social-facebook"
          href="${FACEBOOK_URL}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook UČFR"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M13.7 22v-9h3l.45-3.5H13.7V7.27c0-1.02.28-1.72 1.75-1.72H17.3V2.42c-.32-.04-1.42-.14-2.7-.14-2.67 0-4.5 1.63-4.5 4.63V9.5H7.08V13h3.02v9h3.6Z"/>
          </svg>
          <span>Facebook</span>
        </a>

        <a
          class="ucfr-social-link ucfr-social-instagram"
          href="${INSTAGRAM_URL}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram UČFR"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7.7 2h8.6A5.7 5.7 0 0 1 22 7.7v8.6a5.7 5.7 0 0 1-5.7 5.7H7.7A5.7 5.7 0 0 1 2 16.3V7.7A5.7 5.7 0 0 1 7.7 2Zm-.2 2.1A3.4 3.4 0 0 0 4.1 7.5v9A3.4 3.4 0 0 0 7.5 20h9a3.4 3.4 0 0 0 3.4-3.4v-9a3.4 3.4 0 0 0-3.4-3.4h-9Zm9.2 1.6a1.35 1.35 0 1 1 0 2.7 1.35 1.35 0 0 1 0-2.7ZM12 7.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 2.1a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/>
          </svg>
          <span>Instagram</span>
        </a>
      </div>
    `;
  }

  function installSocialLinks() {
    const footer = document.querySelector('footer#contact');
    if (!footer) return;

    let block = footer.querySelector('.ucfr-social-block');
    if (!block) {
      block = document.createElement('div');
      block.className = 'ucfr-social-block';
      const copy = footer.querySelector('.copy');
      footer.insertBefore(block, copy || null);
    }

    block.innerHTML = socialMarkup();
  }

  let frame = null;
  const scheduleInstall = () => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      installSocialLinks();
    });
  };

  document.addEventListener('DOMContentLoaded', scheduleInstall, { once: true });

  const observer = new MutationObserver(scheduleInstall);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
