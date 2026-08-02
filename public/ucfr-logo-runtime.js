(() => {
  'use strict';

  const LOGO_URL = '/assets/ucfr-logo.svg?v=13';
  const LOGO_PATTERN = /\/assets\/ucfr-logo\.(?:svg|png|jpe?g|webp)(?:\?[^"'\s]*)?/i;
  const PRINT_FRAME_ID = 'ucfr-member-card-print-frame';

  function normalizedLogoUrl(value) {
    const text = String(value || '');
    return LOGO_PATTERN.test(text) ? text.replace(LOGO_PATTERN, LOGO_URL) : text;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function ucfrLogoFetch(input, init) {
    if (typeof input === 'string' || input instanceof URL) {
      return nativeFetch(normalizedLogoUrl(input), init);
    }

    if (input instanceof Request && LOGO_PATTERN.test(input.url)) {
      return nativeFetch(new Request(normalizedLogoUrl(input.url), input), init);
    }

    return nativeFetch(input, init);
  };

  function updateLogoReferences(root = document) {
    root.querySelectorAll?.('img[src], source[src], link[href]').forEach((element) => {
      const attribute = element.hasAttribute('src') ? 'src' : 'href';
      const current = element.getAttribute(attribute) || '';
      const updated = normalizedLogoUrl(current);
      if (updated !== current) element.setAttribute(attribute, updated);
    });

    root.querySelectorAll?.('[srcset]').forEach((element) => {
      const current = element.getAttribute('srcset') || '';
      const updated = normalizedLogoUrl(current);
      if (updated !== current) element.setAttribute('srcset', updated);
    });
  }

  function removePrintFrame() {
    document.getElementById(PRINT_FRAME_ID)?.remove();
  }

  function printSvgWithoutPopup(svg) {
    if (!String(svg || '').trim()) {
      throw new Error('Členský průkaz není připraven k tisku.');
    }

    removePrintFrame();

    const frame = document.createElement('iframe');
    frame.id = PRINT_FRAME_ID;
    frame.title = 'Tisk členského průkazu UČFR';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';

    document.body.appendChild(frame);

    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument || printWindow?.document;

    if (!printWindow || !printDocument) {
      removePrintFrame();
      throw new Error('Tisk nelze v tomto prohlížeči spustit.');
    }

    const cleanup = () => {
      window.setTimeout(removePrintFrame, 500);
    };

    printWindow.addEventListener('afterprint', cleanup, { once: true });

    printDocument.open();
    printDocument.write(`<!doctype html>
      <html lang="cs">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>UČFR členský průkaz</title>
          <style>
            @page { size: 85.6mm 53.98mm; margin: 0; }
            html, body {
              width: 85.6mm;
              height: 53.98mm;
              margin: 0;
              padding: 0;
              overflow: hidden;
              background: #fff;
            }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            svg {
              display: block;
              width: 85.6mm;
              height: 53.98mm;
            }
          </style>
        </head>
        <body>${svg}</body>
      </html>`);
    printDocument.close();

    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error('UČFR print error:', error);
        removePrintFrame();
      }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  const observer = new MutationObserver((mutations) => {
    patchCardPrintEngine();

    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        updateLogoReferences(mutation.target.parentElement || document);
        continue;
      }
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) updateLogoReferences(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'href', 'srcset'],
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
      if (message) {
        message.textContent = 'Tiskový dialog byl otevřen.';
        message.style.color = '#0b4ea2';
      }
    } catch (error) {
      const message = workbench.querySelector('.cafr-card-message');
      if (message) {
        message.textContent = error.message || 'Tisk se nezdařil.';
        message.style.color = '#b42318';
      }
    }
  }, true);

  window.UCFRPrintMemberCard = printSvgWithoutPopup;
  window.addEventListener('pageshow', apply);
})();
