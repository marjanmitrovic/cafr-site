(() => {
  'use strict';

  const LOGO_PATTERN = /\/assets\/ucfr-logo\.(?:svg|png|jpe?g|webp)(?:\?[^"'\s]*)?/i;
  const PRINT_FRAME_ID = 'ucfr-member-card-print-frame';
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="UČFR"><defs><clipPath id="s"><path d="M36 22h248v165c0 61-44 99-124 122C80 286 36 248 36 187Z"/></clipPath></defs><path d="M36 22h248v165c0 61-44 99-124 122C80 286 36 248 36 187Z" fill="#fff" stroke="#0b4ea2" stroke-width="8"/><g clip-path="url(#s)"><rect x="36" y="22" width="248" height="54" fill="#fff"/><rect x="36" y="76" width="248" height="54" fill="#d7141a"/><path d="M36 22 105 76 36 130Z" fill="#11457e"/></g><circle cx="160" cy="168" r="105" fill="#fff" stroke="#0b4ea2" stroke-width="8"/><circle cx="160" cy="168" r="93" fill="#0b4ea2"/><text x="160" y="145" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="58" letter-spacing="2" fill="#fff">UČFR</text><path d="M74 166c28 0 50 9 67 27l-19 27c-18-14-35-21-53-23-7-1-11-8-8-14l7-13c1-3 3-4 6-4Z" fill="#fff"/><circle cx="69" cy="182" r="7" fill="#0b4ea2"/><path d="M132 191c12 1 23 7 33 18l-23 34c-11 17-26 24-45 20l-9-2 18-34 26-36Z" fill="#fff"/><path d="M202 184c35 0 64 29 64 64s-29 64-64 64-64-29-64-64 29-64 64-64Z" fill="#fff" stroke="#0b4ea2" stroke-width="6"/><path d="m202 209 18 13-7 21h-22l-7-21Z" fill="#0b4ea2"/><path d="m202 184 15 17-15 8-15-8Zm39 18-3 23-18-3 5-20Zm17 37-21 10-8-16 10-8Zm-9 40-23-4 3-19 20-7Zm-34 28-13-18 14-14 18 4Zm-41-5 3-23 19 3 6 17Zm-29-31 20-10 9 17-17 11Zm7-42 23 4-4 19-19 9Zm31-34 12 18-13 14-19-5Z" fill="#0b4ea2"/><path d="M36 250h248v56H36Z" fill="#fff" opacity=".94"/><text x="160" y="285" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="24" fill="#0b4ea2">UČFR</text></svg>`;
  const LOGO_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_SVG)}`;

  function isLogoRequest(value) {
    return LOGO_PATTERN.test(String(value || ''));
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function ucfrLogoFetch(input, init) {
    const url = input instanceof Request ? input.url : String(input || '');
    if (isLogoRequest(url)) {
      return Promise.resolve(new Response(LOGO_SVG, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml;charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }));
    }
    return nativeFetch(input, init);
  };

  function applyInlineLogo(element) {
    if (!element) return;
    const attribute = element.hasAttribute('src') ? 'src' : 'href';
    const current = element.getAttribute(attribute) || '';
    if (!isLogoRequest(current)) return;
    element.setAttribute(attribute, LOGO_DATA_URL);
  }

  function updateLogoReferences(root = document) {
    root.querySelectorAll?.('img[src], source[src], link[href]').forEach(applyInlineLogo);
    if (root.matches?.('img[src], source[src], link[href]')) applyInlineLogo(root);

    root.querySelectorAll?.('[srcset]').forEach((element) => {
      const current = element.getAttribute('srcset') || '';
      if (isLogoRequest(current)) element.setAttribute('srcset', LOGO_DATA_URL);
    });
  }

  document.addEventListener('error', (event) => {
    const element = event.target;
    if (element?.tagName === 'IMG' && isLogoRequest(element.getAttribute('src'))) {
      element.src = LOGO_DATA_URL;
    }
  }, true);

  function removePrintFrame() {
    document.getElementById(PRINT_FRAME_ID)?.remove();
  }

  function printSvgWithoutPopup(svg) {
    if (!String(svg || '').trim()) throw new Error('Členský průkaz není připraven k tisku.');
    removePrintFrame();

    const frame = document.createElement('iframe');
    frame.id = PRINT_FRAME_ID;
    frame.title = 'Tisk členského průkazu UČFR';
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
      position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px',
      border: '0', opacity: '0', pointerEvents: 'none',
    });
    document.body.appendChild(frame);

    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument || printWindow?.document;
    if (!printWindow || !printDocument) {
      removePrintFrame();
      throw new Error('Tisk nelze v tomto prohlížeči spustit.');
    }

    printWindow.addEventListener('afterprint', () => window.setTimeout(removePrintFrame, 500), { once: true });
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>UČFR členský průkaz</title><style>@page{size:85.6mm 53.98mm;margin:0}html,body{width:85.6mm;height:53.98mm;margin:0;padding:0;overflow:hidden;background:#fff}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}svg{display:block;width:85.6mm;height:53.98mm}</style></head><body>${svg}</body></html>`);
    printDocument.close();
    window.setTimeout(() => {
      try { printWindow.focus(); printWindow.print(); }
      catch (error) { console.error('UČFR print error:', error); removePrintFrame(); }
    }, 180);
    window.setTimeout(removePrintFrame, 60000);
    return true;
  }

  function patchCardPrintEngine() {
    const engine = window.CAFRMemberCards;
    if (!engine || engine.__ucfrPopupFreePrint) return false;
    engine.printSvg = printSvgWithoutPopup;
    engine.__ucfrPopupFreePrint = true;
    return true;
  }

  function apply() {
    updateLogoReferences(document);
    patchCardPrintEngine();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();

  const observer = new MutationObserver((mutations) => {
    patchCardPrintEngine();
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') updateLogoReferences(mutation.target);
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) updateLogoReferences(node);
      });
    }
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href', 'srcset'],
  });

  const printPatchTimer = window.setInterval(() => {
    if (patchCardPrintEngine()) window.clearInterval(printPatchTimer);
  }, 100);
  window.setTimeout(() => window.clearInterval(printPatchTimer), 30000);

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-card-action="print"]');
    if (!button || button.disabled) return;
    const workbench = button.closest('.cafr-card-workbench');
    const svg = workbench?.querySelector('.cafr-card-preview-shell svg');
    if (!svg) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      printSvgWithoutPopup(svg.outerHTML);
      const message = workbench.querySelector('.cafr-card-message');
      if (message) { message.textContent = 'Tiskový dialog byl otevřen.'; message.style.color = '#0b4ea2'; }
    } catch (error) {
      const message = workbench.querySelector('.cafr-card-message');
      if (message) { message.textContent = error.message || 'Tisk se nezdařil.'; message.style.color = '#b42318'; }
    }
  }, true);

  window.UCFR_LOGO_SVG = LOGO_SVG;
  window.UCFR_LOGO_DATA_URL = LOGO_DATA_URL;
  window.UCFRPrintMemberCard = printSvgWithoutPopup;
  window.addEventListener('pageshow', apply);
})();
