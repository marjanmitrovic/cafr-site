(() => {
  'use strict';

  function enhance(form) {
    const input = form?.querySelector('input[name="facrId"]');
    if (!input || input.dataset.facrVerifyUi === 'true') return;
    input.dataset.facrVerifyUi = 'true';

    const note = document.createElement('small');
    note.className = 'facr-verification-note';
    note.innerHTML = document.documentElement.lang === 'en'
      ? 'FAČR ID and surname are automatically verified against the <a href="https://upgrade4.is.fotbal.cz/members?discipline=football" target="_blank" rel="noopener">public FAČR member database</a> before registration.'
      : 'ID FAČR a příjmení se před registrací automaticky ověřují ve <a href="https://upgrade4.is.fotbal.cz/members?discipline=football" target="_blank" rel="noopener">veřejné databázi členů FAČR</a>.';
    note.style.display = 'block';
    note.style.marginTop = '7px';
    note.style.color = '#607086';
    note.style.fontSize = '12px';
    note.style.lineHeight = '1.45';
    input.insertAdjacentElement('afterend', note);
  }

  function scan(root = document) {
    if (root.matches?.('#joinForm')) enhance(root);
    root.querySelectorAll?.('#joinForm').forEach(enhance);
  }

  scan();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
