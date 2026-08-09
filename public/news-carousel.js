(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001'
      : window.location.origin);

  let newsPromise = null;

  function isCzech() {
    return document.documentElement.lang !== 'en';
  }

  function ensureStyles() {
    if (document.getElementById('ucfrNewsCarouselStyles')) return;
    const style = document.createElement('style');
    style.id = 'ucfrNewsCarouselStyles';
    style.textContent = `
      .grid.news.ucfr-news-carousel {
        display: flex !important;
        grid-template-columns: none !important;
        gap: 20px;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 4px 4px 18px;
        scroll-behavior: smooth;
        scroll-snap-type: x mandatory;
        scrollbar-width: thin;
        overscroll-behavior-inline: contain;
        -webkit-overflow-scrolling: touch;
      }
      .grid.news.ucfr-news-carousel > * {
        flex: 0 0 clamp(300px, 32vw, 390px);
        width: clamp(300px, 32vw, 390px);
        scroll-snap-align: start;
      }
      .ucfr-news-carousel-controls {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin: -6px 0 14px;
      }
      .ucfr-news-carousel-arrow {
        width: 44px;
        height: 44px;
        border: 1px solid rgba(18, 70, 118, .2);
        border-radius: 50%;
        background: #fff;
        color: #0b2a55;
        font-size: 24px;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 8px 22px rgba(11, 42, 85, .1);
      }
      .ucfr-news-carousel-arrow:hover,
      .ucfr-news-carousel-arrow:focus-visible {
        background: #0b2a55;
        color: #fff;
      }
      .ucfr-news-carousel-arrow:disabled {
        opacity: .35;
        cursor: default;
        background: #fff;
        color: #0b2a55;
      }
      .ucfr-news-external {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #0b5aa5;
        font-weight: 800;
        text-decoration: none;
      }
      .ucfr-news-external:hover,
      .ucfr-news-external:focus-visible {
        text-decoration: underline;
      }
      @media (max-width: 700px) {
        .grid.news.ucfr-news-carousel {
          gap: 14px;
          padding-inline: 2px;
        }
        .grid.news.ucfr-news-carousel > * {
          flex-basis: min(84vw, 340px);
          width: min(84vw, 340px);
        }
        .ucfr-news-carousel-controls {
          justify-content: space-between;
          margin-bottom: 10px;
        }
      }
      html.theme-dark .ucfr-news-carousel-arrow {
        border-color: rgba(255,255,255,.18);
        background: #102b49;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function setButtonState(grid, previous, next) {
    const max = Math.max(0, grid.scrollWidth - grid.clientWidth);
    previous.disabled = grid.scrollLeft <= 8;
    next.disabled = grid.scrollLeft >= max - 8;
  }

  async function loadNews() {
    if (!newsPromise) {
      newsPromise = fetch(`${API_BASE}/api/news?carousel=${Date.now()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
        .then((response) => response.ok ? response.json() : [])
        .then((data) => Array.isArray(data) ? data : [])
        .catch(() => []);
    }
    return newsPromise;
  }

  async function shareExternal(article, button) {
    const title = isCzech() ? article.titleCs : (article.titleEn || article.titleCs);
    const text = isCzech() ? article.textCs : (article.textEn || article.textCs || '');
    const url = article.externalUrl;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      const original = button.textContent;
      button.textContent = isCzech() ? 'Odkaz zkopírován' : 'Link copied';
      setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1600);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  }

  async function decorateExternalArticles(grid) {
    const articles = await loadNews();
    for (const article of articles) {
      if (!article.externalUrl) continue;

      const openButton = grid.querySelector(`[data-news-id="${CSS.escape(String(article.id))}"]`);
      if (openButton && openButton.tagName !== 'A') {
        const link = document.createElement('a');
        link.className = 'ucfr-news-open ucfr-news-external';
        link.href = article.externalUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = isCzech() ? 'Otevřít celý článek ↗' : 'Open full article ↗';
        openButton.replaceWith(link);
      }

      const card = grid.querySelector(`[data-news-share="${CSS.escape(String(article.id))}"]`)?.closest('.ucfr-news-card');
      if (card) {
        const paragraph = card.querySelector('.ucfr-news-content > p');
        if (paragraph && !paragraph.textContent.trim()) {
          paragraph.textContent = isCzech()
            ? 'Externí článek – celý text se otevře na zdrojovém webu.'
            : 'External article – the full text opens on the source website.';
        }

        const share = card.querySelector(`[data-news-share="${CSS.escape(String(article.id))}"]`);
        if (share && share.dataset.externalBound !== 'true') {
          const replacement = share.cloneNode(true);
          replacement.dataset.externalBound = 'true';
          replacement.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            shareExternal(article, replacement);
          });
          share.replaceWith(replacement);
        }
      }
    }
  }

  function enhance(grid) {
    if (!grid) return;

    if (grid.dataset.newsCarouselReady !== 'true') {
      grid.dataset.newsCarouselReady = 'true';
      grid.classList.add('ucfr-news-carousel');

      const controls = document.createElement('div');
      controls.className = 'ucfr-news-carousel-controls';
      controls.setAttribute('aria-label', isCzech() ? 'Posun aktualit' : 'News navigation');
      controls.innerHTML = `
        <button class="ucfr-news-carousel-arrow" type="button" data-news-carousel-prev aria-label="${isCzech() ? 'Předchozí články' : 'Previous articles'}">‹</button>
        <button class="ucfr-news-carousel-arrow" type="button" data-news-carousel-next aria-label="${isCzech() ? 'Další články' : 'Next articles'}">›</button>
      `;
      grid.before(controls);

      const previous = controls.querySelector('[data-news-carousel-prev]');
      const next = controls.querySelector('[data-news-carousel-next]');
      const distance = () => Math.max(280, Math.min(grid.clientWidth * .82, 420));

      previous.addEventListener('click', () => grid.scrollBy({ left: -distance(), behavior: 'smooth' }));
      next.addEventListener('click', () => grid.scrollBy({ left: distance(), behavior: 'smooth' }));
      grid.addEventListener('scroll', () => setButtonState(grid, previous, next), { passive: true });
      window.addEventListener('resize', () => setButtonState(grid, previous, next), { passive: true });
      requestAnimationFrame(() => setButtonState(grid, previous, next));
    }

    decorateExternalArticles(grid);
  }

  function scan() {
    document.querySelectorAll('.grid.news').forEach(enhance);
  }

  ensureStyles();
  scan();

  window.addEventListener('ucfr-news-updated', () => {
    newsPromise = null;
    setTimeout(scan, 50);
  });

  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      scan();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
