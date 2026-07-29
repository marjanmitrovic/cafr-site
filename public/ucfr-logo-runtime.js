(() => {
  'use strict';

  const LOGO_URL = '/assets/ucfr-logo.jpg?v=12';
  const LOGO_PATTERN = /\/assets\/ucfr-logo\.(?:svg|png|jpe?g)(?:\?[^"'\s]*)?/i;

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

  function apply() {
    updateLogoReferences(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  const observer = new MutationObserver((mutations) => {
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

  window.addEventListener('pageshow', apply);
})();
