(() => {
  'use strict';

  function setMessage(container, message, isError = false) {
    const element = container?.querySelector?.('.cafr-card-message');
    if (!element) return;
    element.textContent = message || '';
    element.style.color = isError ? '#b42318' : '#0b4ea2';
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

    // A short delay lets mobile browsers finish rendering the SVG in the iframe.
    window.setTimeout(runPrint, 180);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-card-action="print"]');
    if (!button) return;

    const workbench = button.closest('.cafr-card-workbench');
    const preview = workbench?.querySelector('.cafr-card-preview-shell');
    const svg = preview?.querySelector('svg')?.outerHTML;
    if (!workbench || !svg) return;

    // Stop the legacy handler, which uses window.open() and gets blocked on mobile.
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
})();
