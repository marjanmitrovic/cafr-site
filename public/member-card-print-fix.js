(() => {
  'use strict';

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function setMessage(container, message, isError = false) {
    const element = container?.querySelector?.('.cafr-card-message');
    if (!element) return;
    element.textContent = message || '';
    element.style.color = isError ? '#b42318' : '#0b4ea2';
  }

  function relabelAndroidPrintButtons() {
    if (!isAndroid()) return;
    document.querySelectorAll('[data-card-action="print"]').forEach((button) => {
      if (button.dataset.androidPrintRelabeled === '1') return;
      button.dataset.androidPrintRelabeled = '1';
      button.textContent = 'Tisk / PDF';
      button.title = 'Na Androidu se připraví PDF v přesném rozměru 85,60 × 53,98 mm pro tisk.';
    });
  }

  function printFromIframe(svg, container) {
    const frame = document.createElement('iframe');
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

    const cleanup = () => window.setTimeout(() => frame.remove(), 1200);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      throw new Error('Tisk nelze v tomto prohlížeči spustit. Použijte Stáhnout PDF.');
    }

    doc.open();
    doc.write(`<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<title>UČFR členský průkaz</title>
<style>
@page { size: 85.6mm 53.98mm; margin: 0; }
html, body { width: 85.6mm; height: 53.98mm; margin: 0; padding: 0; overflow: hidden; background: #fff; }
svg { display: block; width: 85.6mm; height: 53.98mm; }
</style>
</head>
<body>${svg}</body>
</html>`);
    doc.close();

    const runPrint = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setMessage(container, 'Tiskový dialog byl otevřen.');
      } catch (error) {
        setMessage(container, 'Přímý tisk není v tomto prohlížeči dostupný. Použijte Stáhnout PDF.', true);
      } finally {
        cleanup();
      }
    };

    window.setTimeout(runPrint, 180);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-card-action="print"]');
    if (!button) return;

    const workbench = button.closest('.cafr-card-workbench');
    if (!workbench) return;

    // Android Chromium/Brave does not provide reliable script-triggered printing.
    // Use the already existing PDF export as the dependable print path.
    if (isAndroid()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const pdfButton = workbench.querySelector('[data-card-action="pdf"]');
      if (!pdfButton) {
        setMessage(workbench, 'PDF pro tisk nelze připravit.', true);
        return;
      }

      setMessage(workbench, 'Brave Android nepodporuje spolehlivý přímý tisk. Připravuji PDF 85,60 × 53,98 mm pro tisk…');
      pdfButton.click();
      return;
    }

    const preview = workbench.querySelector('.cafr-card-preview-shell');
    const svg = preview?.querySelector('svg')?.outerHTML;
    if (!svg) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      setMessage(workbench, 'Připravuji tisk…');
      printFromIframe(svg, workbench);
    } catch (error) {
      setMessage(workbench, error.message || 'Tisk se nezdařil. Použijte Stáhnout PDF.', true);
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', relabelAndroidPrintButtons, { once: true });
  } else {
    relabelAndroidPrintButtons();
  }

  const observer = new MutationObserver(relabelAndroidPrintButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
