(() => {
  'use strict';

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

  function enhance(grid) {
    if (!grid || grid.dataset.newsCarouselReady === 'true') return;

    grid.dataset.newsCarouselReady = 'true';
    grid.classList.add('ucfr-news-carousel');

    const controls = document.createElement('div');
    controls.className = 'ucfr-news-carousel-controls';
    controls.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'News navigation' : 'Posun aktualit');
    controls.innerHTML = `
      <button class="ucfr-news-carousel-arrow" type="button" data-news-carousel-prev aria-label="${document.documentElement.lang === 'en' ? 'Previous articles' : 'Předchozí články'}">‹</button>
      <button class="ucfr-news-carousel-arrow" type="button" data-news-carousel-next aria-label="${document.documentElement.lang === 'en' ? 'Next articles' : 'Další články'}">›</button>
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

  function scan() {
    document.querySelectorAll('.grid.news').forEach(enhance);
  }

  ensureStyles();
  scan();

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
