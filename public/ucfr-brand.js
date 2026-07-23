(() => {
  'use strict';

  const LOGO_PATH = '/assets/ucfr-logo.svg';
  const replacements = [
    ['ČESKÁ ASOCIACE FOTBALOVÝCH ROZHODČÍCH', 'UNIE ČESKÝCH FOTBALOVÝCH ROZHODČÍCH'],
    ['Česká asociace fotbalových rozhodčích', 'Unie českých fotbalových rozhodčích'],
    ['Czech Association of Football Referees', 'Union of Czech Football Referees'],
    ['ČESKÁ ASOCIACE', 'UNIE ČESKÝCH'],
    ['Česká asociace', 'Unie českých'],
    ['ČAFR', 'UČFR'],
  ];

  function replaceBrand(value) {
    return replacements.reduce(
      (result, [from, to]) => String(result ?? '').split(from).join(to),
      value,
    );
  }

  function updateElement(element) {
    if (!(element instanceof Element)) return;

    if (element.matches('img[src$="/assets/cafr-logo.png"], img[src="/assets/cafr-logo.png"]')) {
      element.setAttribute('src', LOGO_PATH);
    }

    if (element.matches('link[rel~="icon"], link[rel="apple-touch-icon"]')) {
      const href = element.getAttribute('href') || '';
      if (href.endsWith('/assets/cafr-logo.png')) element.setAttribute('href', LOGO_PATH);
    }

    for (const attribute of ['alt', 'title', 'aria-label', 'placeholder', 'content']) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute) || '';
      const next = replaceBrand(current);
      if (next !== current) element.setAttribute(attribute, next);
    }
  }

  function updateTree(root = document.documentElement) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (!parent || parent.closest('script, style, textarea, code, pre')) return;
      const current = root.nodeValue || '';
      const next = replaceBrand(current);
      if (next !== current) root.nodeValue = next;
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) updateElement(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) updateElement(node);
      else updateTree(node);
      node = walker.nextNode();
    }
  }

  function patchCardEngine() {
    const engine = window.CAFRMemberCards;
    if (!engine || engine.__ucfrBrandPatched) return;

    const patched = Object.freeze({
      ...engine,
      __ucfrBrandPatched: true,
      renderCardSvg: async (...args) => replaceBrand(await engine.renderCardSvg(...args)),
    });

    window.CAFRMemberCards = patched;
    window.UCFRMemberCards = patched;
  }

  function applyBrand() {
    document.title = replaceBrand(document.title);
    updateTree(document.documentElement);
    patchCardEngine();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => updateTree(node));
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        updateElement(mutation.target);
      }
    }
    patchCardEngine();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'href', 'alt', 'title', 'aria-label', 'placeholder', 'content'],
  });

  applyBrand();
  window.addEventListener('DOMContentLoaded', applyBrand, { once: true });
  window.setTimeout(applyBrand, 0);
})();
