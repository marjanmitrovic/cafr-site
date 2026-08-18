(() => {
  const SECTION_ID = 'supporters';

  const translations = {
    cs: {
      kicker: 'PARTNEŘI A PODPORA',
      title: 'Prostor pro partnery UČFR',
      description: 'Nenápadné místo pro reklamní partnery, sponzory a dárce, kteří podporují činnost UČFR.',
      tabsLabel: 'Partneři a podpora UČFR',
      advertising: 'Reklama',
      sponsors: 'Sponzoři',
      donors: 'Dárci',
      adPartner: 'Reklamní partner',
      adMeta: 'logo • odkaz • krátké sdělení',
      mainSponsor: 'Hlavní sponzor',
      projectPartner: 'Partner projektu',
      sponsorMeta: 'místo pro logo a odkaz',
      donorTitle: 'Děkujeme našim dárcům.',
      donorText: 'Jméno, název organizace nebo anonymní podpora budou uvedeny pouze se souhlasem dárce.'
    },
    en: {
      kicker: 'PARTNERS & SUPPORT',
      title: 'Space for UČFR partners',
      description: 'A discreet place for advertising partners, sponsors and donors who support the work of UČFR.',
      tabsLabel: 'UČFR partners and support',
      advertising: 'Advertising',
      sponsors: 'Sponsors',
      donors: 'Donors',
      adPartner: 'Advertising partner',
      adMeta: 'logo • link • short message',
      mainSponsor: 'Main sponsor',
      projectPartner: 'Project partner',
      sponsorMeta: 'space for logo and link',
      donorTitle: 'Thank you to our donors.',
      donorText: 'A name, organisation or anonymous contribution will be listed only with the donor’s consent.'
    }
  };

  function getText() {
    return translations[document.documentElement.lang === 'en' ? 'en' : 'cs'];
  }

  function injectSection() {
    const footer = document.querySelector('footer#contact');
    if (!footer || document.getElementById(SECTION_ID)) return;

    const t = getText();
    const section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'supporters-section';
    section.setAttribute('aria-labelledby', 'supporters-title');

    section.innerHTML = `
      <div class="supporters-shell">
        <div class="supporters-intro">
          <span class="supporters-kicker">${t.kicker}</span>
          <h2 id="supporters-title">${t.title}</h2>
          <p>${t.description}</p>
        </div>

        <div class="supporters-tabs">
          <input type="radio" name="supporters-tab" id="supporters-ad" checked>
          <input type="radio" name="supporters-tab" id="supporters-sponsors">
          <input type="radio" name="supporters-tab" id="supporters-donors">

          <div class="supporters-tablist" aria-label="${t.tabsLabel}">
            <label for="supporters-ad">${t.advertising}</label>
            <label for="supporters-sponsors">${t.sponsors}</label>
            <label for="supporters-donors">${t.donors}</label>
          </div>

          <div class="supporters-panels">
            <div class="supporters-panel supporters-panel-ad">
              <div class="supporters-slot-grid">
                <div class="supporters-placeholder">
                  <span>${t.adPartner}</span>
                  <small>${t.adMeta}</small>
                </div>
                <div class="supporters-placeholder">
                  <span>${t.adPartner}</span>
                  <small>${t.adMeta}</small>
                </div>
              </div>
            </div>

            <div class="supporters-panel supporters-panel-sponsors">
              <div class="supporters-slot-grid">
                <div class="supporters-placeholder">
                  <span>${t.mainSponsor}</span>
                  <small>${t.sponsorMeta}</small>
                </div>
                <div class="supporters-placeholder">
                  <span>${t.projectPartner}</span>
                  <small>${t.sponsorMeta}</small>
                </div>
              </div>
            </div>

            <div class="supporters-panel supporters-panel-donors">
              <div class="supporters-note">
                <strong>${t.donorTitle}</strong><br>
                ${t.donorText}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    footer.before(section);
  }

  function start() {
    injectSection();

    const app = document.getElementById('app');
    if (!app) return;

    const observer = new MutationObserver(() => injectSection());
    observer.observe(app, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
