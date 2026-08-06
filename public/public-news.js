(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001'
      : window.location.origin);

  let articles = null;
  let loading = null;

  function isCzech() {
    return (localStorage.getItem('cafr-lang') || document.documentElement.lang || 'cs') !== 'en';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function safeImageUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (url.startsWith('/')) return url;
    try {
      const parsed = new URL(url, window.location.origin);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(isCzech() ? 'cs-CZ' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function articleTitle(article) {
    return isCzech()
      ? article.titleCs
      : (article.titleEn || article.titleCs);
  }

  function articleText(article) {
    return isCzech()
      ? article.textCs
      : (article.textEn || article.textCs);
  }

  function excerpt(text, length = 190) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    return normalized.length > length ? `${normalized.slice(0, length).trim()}…` : normalized;
  }

  function ensureStyles() {
    if (document.querySelector('#ucfrPublicNewsStyles')) return;
    const style = document.createElement('style');
    style.id = 'ucfrPublicNewsStyles';
    style.textContent = `
      .news.ucfr-live-news {
        align-items: stretch;
      }
      .news.ucfr-live-news .ucfr-news-card {
        overflow: hidden;
        padding: 0;
        display: flex;
        flex-direction: column;
        min-height: 100%;
        background: var(--surface, #fff);
      }
      .ucfr-news-image-wrap {
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: #e8edf4;
      }
      .ucfr-news-image-wrap img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        transition: transform .25s ease;
      }
      .ucfr-news-card:hover .ucfr-news-image-wrap img {
        transform: scale(1.025);
      }
      .ucfr-news-content {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 10px;
        padding: 20px;
      }
      .ucfr-news-content small {
        color: #65758b;
        font-weight: 700;
      }
      .ucfr-news-content h3 {
        margin: 0;
      }
      .ucfr-news-content p {
        margin: 0;
        white-space: pre-line;
      }
      .ucfr-news-open {
        align-self: flex-start;
        margin-top: auto;
        border: 0;
        padding: 0;
        color: #0b5aa5;
        background: transparent;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      .ucfr-news-modal {
        position: fixed;
        inset: 0;
        z-index: 12000;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(5, 18, 35, .76);
      }
      .ucfr-news-modal[hidden] {
        display: none;
      }
      .ucfr-news-modal-card {
        position: relative;
        width: min(860px, 100%);
        max-height: min(90vh, 900px);
        overflow: auto;
        border-radius: 18px;
        background: #fff;
        box-shadow: 0 28px 80px rgba(0, 0, 0, .34);
      }
      .ucfr-news-modal-card > img {
        width: 100%;
        max-height: 430px;
        display: block;
        object-fit: cover;
      }
      .ucfr-news-modal-body {
        padding: 28px;
      }
      .ucfr-news-modal-body h2 {
        margin: 7px 0 16px;
      }
      .ucfr-news-modal-body p {
        margin: 0;
        line-height: 1.75;
        white-space: pre-wrap;
      }
      .ucfr-news-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 50%;
        color: #fff;
        background: rgba(0, 0, 0, .68);
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
      }
      @media (max-width: 640px) {
        .ucfr-news-modal {
          padding: 10px;
        }
        .ucfr-news-modal-body {
          padding: 21px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.querySelector('#ucfrNewsModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'ucfrNewsModal';
    modal.className = 'ucfr-news-modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="ucfr-news-modal-card" role="dialog" aria-modal="true"><button class="ucfr-news-modal-close" type="button" aria-label="Close">×</button><div class="ucfr-news-modal-slot"></div></div>';
    document.body.appendChild(modal);

    const close = () => {
      modal.hidden = true;
      document.body.style.removeProperty('overflow');
    };

    modal.querySelector('.ucfr-news-modal-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) close();
    });

    return modal;
  }

  function openArticle(id) {
    const article = (articles || []).find((item) => item.id === id);
    if (!article) return;

    const modal = ensureModal();
    const title = articleTitle(article);
    const text = articleText(article);
    const image = safeImageUrl(article.imageUrl);
    modal.querySelector('.ucfr-news-modal-slot').innerHTML = `
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}">` : ''}
      <div class="ucfr-news-modal-body">
        <small>${escapeHtml(formatDate(article.publishedAt))}</small>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  async function loadArticles(force = false) {
    if (articles && !force) return articles;
    if (loading && !force) return loading;

    loading = fetch(`${API_BASE}/api/news`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data.error || 'News could not be loaded');
        articles = Array.isArray(data) ? data : [];
        return articles;
      })
      .catch((error) => {
        console.warn('UČFR news:', error);
        articles = [];
        return articles;
      })
      .finally(() => {
        loading = null;
      });

    return loading;
  }

  function renderInto(grid) {
    if (!grid || !Array.isArray(articles) || articles.length === 0) return;

    const language = isCzech() ? 'cs' : 'en';
    const signature = `${language}:${articles.map((article) => `${article.id}:${article.updatedAt || article.publishedAt}`).join('|')}`;
    if (grid.dataset.ucfrNewsSignature === signature) return;

    grid.dataset.ucfrNewsSignature = signature;
    grid.classList.add('ucfr-live-news');
    grid.innerHTML = articles.map((article) => {
      const title = articleTitle(article);
      const text = articleText(article);
      const image = safeImageUrl(article.imageUrl);
      return `
        <article class="ucfr-news-card">
          ${image ? `<div class="ucfr-news-image-wrap"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy"></div>` : ''}
          <div class="ucfr-news-content">
            <small>${escapeHtml(formatDate(article.publishedAt))}</small>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(excerpt(text))}</p>
            <button class="ucfr-news-open" type="button" data-news-id="${escapeHtml(article.id)}">
              ${isCzech() ? 'Číst celý článek' : 'Read full article'} →
            </button>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-news-id]').forEach((button) => {
      button.addEventListener('click', () => openArticle(button.dataset.newsId));
    });
  }

  async function scan() {
    const grid = document.querySelector('.grid.news');
    if (!grid) return;
    await loadArticles();
    renderInto(grid);
  }

  ensureStyles();
  scan();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(scan);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('ucfr-news-updated', async () => {
    await loadArticles(true);
    const grid = document.querySelector('.grid.news');
    if (grid) {
      delete grid.dataset.ucfrNewsSignature;
      renderInto(grid);
    }
  });
})();
