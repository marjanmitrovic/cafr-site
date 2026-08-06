(() => {
  'use strict';

  const API_BASE =
    localStorage.getItem('cafr-api-base') ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001'
      : window.location.origin);

  function isCzech() {
    return document.documentElement.lang !== 'en';
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

  function token() {
    return sessionStorage.getItem('cafr-admin-token') || localStorage.getItem('cafr-token') || '';
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);
    return data;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Soubor nelze načíst.'));
      reader.readAsDataURL(file);
    });
  }

  function ensureStyles() {
    if (document.querySelector('#ucfrAdminNewsStyles')) return;
    const style = document.createElement('style');
    style.id = 'ucfrAdminNewsStyles';
    style.textContent = `
      .admin-news-form {
        margin-bottom: 24px;
        padding: 20px;
        border: 1px solid rgba(110, 130, 155, .25);
        border-radius: 15px;
        background: rgba(245, 248, 252, .78);
      }
      .admin-news-form textarea {
        min-height: 180px;
        resize: vertical;
      }
      .admin-news-preview {
        display: grid;
        grid-template-columns: 150px minmax(0, 1fr);
        gap: 16px;
        width: 100%;
      }
      .admin-news-preview img {
        width: 150px;
        height: 96px;
        border-radius: 10px;
        object-fit: cover;
        background: #e7edf4;
      }
      .admin-news-preview h4 {
        margin: 0 0 7px;
      }
      .admin-news-preview p {
        display: -webkit-box;
        overflow: hidden;
        margin: 0;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
      .admin-news-status-row {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 12px;
      }
      .admin-news-status-row label {
        min-width: 180px;
      }
      @media (max-width: 620px) {
        .admin-news-preview {
          grid-template-columns: 1fr;
        }
        .admin-news-preview img {
          width: 100%;
          height: auto;
          aspect-ratio: 16 / 9;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function articleCard(article) {
    const image = escapeHtml(article.url || '');
    return `
      <article class="admin-member-card">
        <div class="admin-news-preview">
          ${image ? `<img src="${image}" alt="${escapeHtml(article.titleCs)}">` : ''}
          <div>
            <h4>${escapeHtml(article.titleCs)}</h4>
            <p>${escapeHtml(article.descriptionCs || '')}</p>
            <div class="admin-member-meta">
              <span>${new Date(article.createdAt).toLocaleDateString('cs-CZ')}</span>
              <span>${escapeHtml(article.status)}</span>
            </div>
          </div>
        </div>
        <div class="admin-member-controls admin-news-status-row">
          <label>
            ${isCzech() ? 'Stav článku' : 'Article status'}
            <select data-news-status="${escapeHtml(article.id)}">
              ${['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((status) => `<option value="${status}" ${article.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </label>
          <button class="danger-link" data-news-archive="${escapeHtml(article.id)}" type="button">
            ${isCzech() ? 'Archivovat' : 'Archive'}
          </button>
        </div>
      </article>
    `;
  }

  async function renderSection(section) {
    const list = section.querySelector('#adminNewsList');
    const count = section.querySelector('.admin-count');
    if (!list) return;

    try {
      const documents = await request('/api/admin/documents');
      const articles = documents.filter((item) => item.category === 'NEWS');
      if (count) count.textContent = String(articles.filter((item) => item.status !== 'ARCHIVED').length);
      list.innerHTML = articles.length
        ? articles.map(articleCard).join('')
        : `<div class="empty-results"><h3>${isCzech() ? 'Zatím nebyl přidán žádný článek.' : 'No articles have been added yet.'}</h3></div>`;

      list.querySelectorAll('[data-news-status]').forEach((select) => {
        select.addEventListener('change', async () => {
          select.disabled = true;
          try {
            await request(`/api/admin/documents/${encodeURIComponent(select.dataset.newsStatus)}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: select.value }),
            });
            window.dispatchEvent(new CustomEvent('ucfr-news-updated'));
            await renderSection(section);
          } catch (error) {
            alert(error.message);
            select.disabled = false;
          }
        });
      });

      list.querySelectorAll('[data-news-archive]').forEach((button) => {
        button.addEventListener('click', async () => {
          if (!window.confirm(isCzech() ? 'Archivovat tento článek?' : 'Archive this article?')) return;
          button.disabled = true;
          try {
            await request(`/api/admin/documents/${encodeURIComponent(button.dataset.newsArchive)}`, {
              method: 'DELETE',
            });
            window.dispatchEvent(new CustomEvent('ucfr-news-updated'));
            await renderSection(section);
          } catch (error) {
            alert(error.message);
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      list.innerHTML = `<div class="error-panel"><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  function createSection() {
    const section = document.createElement('section');
    section.id = 'adminNewsCms';
    section.className = 'admin-panel-section';
    section.innerHTML = `
      <div class="admin-section-head">
        <div>
          <span class="section-label">DOCUMENTS / NEWS</span>
          <h3>${isCzech() ? 'Články pro Aktuality' : 'News articles'}</h3>
        </div>
        <span class="admin-count">0</span>
      </div>

      <form id="adminNewsForm" class="form admin-news-form">
        <label>
          ${isCzech() ? 'Název článku' : 'Article title'}
          <input name="title" maxlength="180" required>
        </label>
        <label>
          ${isCzech() ? 'Text článku' : 'Article text'}
          <textarea name="text" maxlength="20000" required></textarea>
        </label>
        <label>
          ${isCzech() ? 'Úvodní obrázek' : 'Cover image'}
          <input name="image" type="file" accept="image/png,image/jpeg,image/webp" required>
        </label>
        <label>
          ${isCzech() ? 'Zveřejnění' : 'Publication'}
          <select name="status">
            <option value="PUBLISHED">${isCzech() ? 'Zveřejnit ihned' : 'Publish immediately'}</option>
            <option value="DRAFT">${isCzech() ? 'Uložit jako koncept' : 'Save as draft'}</option>
          </select>
        </label>
        <button class="primary" type="submit">
          ${isCzech() ? 'Přidat článek' : 'Add article'}
        </button>
        <p id="adminNewsMessage" class="form-message" aria-live="polite"></p>
      </form>

      <div class="admin-member-list" id="adminNewsList">
        <div class="loading-state">Loading…</div>
      </div>
    `;

    const form = section.querySelector('#adminNewsForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = section.querySelector('#adminNewsMessage');
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const title = String(data.get('title') || '').trim();
      const text = String(data.get('text') || '').trim();
      const image = data.get('image');
      const status = String(data.get('status') || 'PUBLISHED');

      if (!title || !text || !image?.name) return;
      if (image.size > 8 * 1024 * 1024) {
        message.textContent = isCzech() ? 'Obrázek je příliš velký. Maximum je 8 MB.' : 'The image is too large. Maximum is 8 MB.';
        return;
      }

      submit.disabled = true;
      message.textContent = isCzech() ? 'Nahrávám obrázek a ukládám článek…' : 'Uploading image and saving article…';

      try {
        const fileData = await readFileAsDataUrl(image);
        await request('/api/admin/documents/upload', {
          method: 'POST',
          body: JSON.stringify({
            titleCs: title,
            titleEn: title,
            descriptionCs: text,
            descriptionEn: text,
            category: 'NEWS',
            visibility: 'PUBLIC',
            status,
            fileName: image.name,
            fileData,
          }),
        });

        form.reset();
        message.textContent = status === 'PUBLISHED'
          ? (isCzech() ? 'Článek byl zveřejněn.' : 'The article was published.')
          : (isCzech() ? 'Koncept byl uložen.' : 'The draft was saved.');
        window.dispatchEvent(new CustomEvent('ucfr-news-updated'));
        await renderSection(section);
      } catch (error) {
        message.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });

    return section;
  }

  function scan(root = document) {
    const shells = [];
    if (root.matches?.('.admin-shell')) shells.push(root);
    root.querySelectorAll?.('.admin-shell').forEach((shell) => shells.push(shell));

    shells.forEach((shell) => {
      if (shell.querySelector('#adminNewsCms')) return;
      if (!token()) return;
      const section = createSection();
      shell.appendChild(section);
      renderSection(section);
    });
  }

  ensureStyles();
  scan();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
