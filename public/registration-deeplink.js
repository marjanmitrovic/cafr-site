(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const wantsRegistration = params.get('registrace') === '1' || window.location.hash === '#registrace';
  if (!wantsRegistration) return;

  const labels = [
    'podat přihlášku',
    'stát se členem',
    'apply for membership',
    'become a member'
  ];

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('cs-CZ');
  }

  function tryOpen() {
    const candidates = [...document.querySelectorAll('button, a')];
    const trigger = candidates.find((element) => {
      const text = normalize(element.textContent);
      return labels.some((label) => text.includes(label));
    });

    if (!trigger) return false;
    trigger.click();

    // Keep the clean canonical URL after the modal has opened.
    window.setTimeout(() => {
      try {
        history.replaceState(null, '', `${window.location.pathname}#registrace`);
      } catch {}
    }, 100);
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (tryOpen()) return;
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (tryOpen() || attempts >= 30) window.clearInterval(timer);
      }, 200);
    }, { once: true });
  } else if (!tryOpen()) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (tryOpen() || attempts >= 30) window.clearInterval(timer);
    }, 200);
  }
})();
