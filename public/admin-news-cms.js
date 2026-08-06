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
      cache: 'no-store',
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
      .admin-news-form-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }
      .admin-news-form-head h4 {
        margin: 0;
      }
      .admin-news-form-actions,
      .admin-news-status-row {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 12px;
      }
      .admin-news-current-image {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
        color: #64748b;
        font-size: 13px;
      }
      .admin-news-current-image[hidden] {
        display: none;
      }
      .admin-news-current-image img {
        width: 112px;
        height: 70px;
        border-radius: 9px;
        object-fit: cover;
        background: #e7edf4;
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
        .admin-news-form-head {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function articleCard(article) {
    const image = escapeHtml(article.url || '');
    return `
      <article class="admin-member-card" data-news-card="${escapeHtml(article.id)}">
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
          <button class="secondary dark" data-news-edit="${escapeHtml(article.id)}" type="button">
            ${isCzech() ? 'Upravit článek' : 'Edit article'}
          </button>
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

  function setFormMode(section, article = null) {
    const form = section.querySelector('#adminNewsForm');
    const heading = section.querySelector('#adminNewsFormTitle');
    const submit = section.querySelector('#adminNewsSubmit');
    const cancel = section.querySelector('#adminNewsCancel');
    const imageInput = form.querySelector('[name="image"]');
    const currentImage = section.querySelector('#adminNewsCurrentImage');

    form.reset();
    form.dataset.editingId = article?.id || '';

    if (article) {
      form.querySelector('[name="title"]').value = article.titleCs || '';
      form.querySelector('[name="text"]').value = article.descriptionCs || '';
      form.querySelector('[name="status"]').value = article.status || 'DRAFT';
      imageInput.required = false;
      heading.textContent = isCzech() ? 'Upravit existující článek' : 'Edit existing article';
      submit.textContent = isCzech() ? 'Uložit změny' : 'Save changes';
      cancel.hidden = false;

      if (article.url) {
        currentImage.innerHTML = `
          <img src="${escapeHtml(article.url)}" alt="${escapeHtml(article.titleCs)}">
          <span>${isCzech() ? 'Pokud nevyberete nový obrázek, zůstane tento obrázek zachován.' : 'Leave the image field empty to keep this image.'}</span>
        `;
        currentImage.hidden = false;
      } else {
        currentImage.hidden = true;
      }
    } else {
      imageInput.required = true;
      heading.textContent = isCzech() ? 'Přidat nový článek' : 'Add a new article';
      submit.textContent = isCzech() ? 'Přidat článek' : 'Add article';
      cancel.hidden = true;
      currentImage.hidden = true;
      currentImage.innerHTML = '';
    }
  }

  async function renderSection(section) {
    const list = section.querySelector('#adminNewsList');
    const count = section.querySelector('.admin-count');
    if (!list) return;

    try {
      const documents = await request('/api/admin/documents');
      const articles = documents.filter((item) => item.category === 'NEWS');
      const articleById = new Map(articles.map((item) => [item.id, item]));
      if (count) count.textContent = String(articles.filter((item) => item.status !== 'ARCHIVED').length);
      list.innerHTML = articles.length
        ? articles.map(articleCard).join('')
        : `<div class="empty-results"><h3>${isCzech() ? 'Zatím nebyl přidán žádný článek.' : 'No articles have been added yet.'}</h3></div>`;

      list.querySelectorAll('[data-news-edit]').forEach((button) => {
        button.addEventListener('click', () => {
          const article = articleById.get(button.dataset.newsEdit);
          if (!article) return;
          setFormMode(section, article);
          section.querySelector('#adminNewsMessage').textContent = '';
          section.querySelector('#adminNewsForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

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
            if (section.querySelector('#adminNewsForm').dataset.editingId === button.dataset.newsArchive) {
              setFormMode(section);
            }
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
        <div class="admin-news-form-head">
          <h4 id="adminNewsFormTitle">${isCzech() ? 'Přidat nový článek' : 'Add a new article'}</h4>
          <button id="adminNewsCancel" class="text-button" type="button" hidden>
            ${isCzech() ? 'Zrušit úpravy' : 'Cancel editing'}
          </button>
        </div>
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
          <input name="image" type="file" accept="image/png,image/jpeg" required>
        </label>
        <div id="adminNewsCurrentImage" class="admin-news-current-image" hidden></div>
        <label>
          ${isCzech() ? 'Zveřejnění' : 'Publication'}
          <select name="status">
            <option value="PUBLISHED">${isCzech() ? 'Zveřejnit ihned' : 'Publish immediately'}</option>
            <option value="DRAFT">${isCzech() ? 'Uložit jako koncept' : 'Save as draft'}</option>
            <option value="ARCHIVED">${isCzech() ? 'Archivovat' : 'Archive'}</option>
          </select>
        </label>
        <div class="admin-news-form-actions">
          <button id="adminNewsSubmit" class="primary" type="submit">
            ${isCzech() ? 'Přidat článek' : 'Add article'}
          </button>
        </div>
        <p id="adminNewsMessage" class="form-message" aria-live="polite"></p>
      </form>

      <div class="admin-member-list" id="adminNewsList">
        <div class="loading-state">Loading…</div>
      </div>
    `;

    const form = section.querySelector('#adminNewsForm');
    section.querySelector('#adminNewsCancel').addEventListener('click', () => {
      setFormMode(section);
      section.querySelector('#adminNewsMessage').textContent = '';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = section.querySelector('#adminNewsMessage');
      const submit = section.querySelector('#adminNewsSubmit');
      const data = new FormData(form);
      const editingId = String(form.dataset.editingId || '');
      const title = String(data.get('title') || '').trim();
      const text = String(data.get('text') || '').trim();
      const image = data.get('image');
      const hasImage = Boolean(image?.name && image.size > 0);
      const status = String(data.get('status') || 'PUBLISHED');

      if (!title || !text || (!editingId && !hasImage)) return;
      if (hasImage && image.size > 8 * 1024 * 1024) {
        message.textContent = isCzech() ? 'Obrázek je příliš velký. Maximum je 8 MB.' : 'The image is too large. Maximum is 8 MB.';
        return;
      }

      submit.disabled = true;
      message.textContent = editingId
        ? (isCzech() ? 'Ukládám změny článku…' : 'Saving article changes…')
        : (isCzech() ? 'Nahrávám obrázek a ukládám článek…' : 'Uploading image and saving article…');

      try {
        const payload = {
          titleCs: title,
          titleEn: title,
          descriptionCs: text,
          descriptionEn: text,
          category: 'NEWS',
          visibility: 'PUBLIC',
          status,
        };

        if (hasImage) {
          payload.fileName = image.name;
          payload.fileData = await readFileAsDataUrl(image);
        }

        if (editingId) {
          await request(`/api/admin/news/${encodeURIComponent(editingId)}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
        } else {
          await request('/api/admin/documents/upload', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }

        setFormMode(section);
        message.textContent = editingId
          ? (isCzech() ? 'Změny článku byly uloženy.' : 'Article changes were saved.')
          : status === 'PUBLISHED'
            ? (isCzech() ? 'Článek byl zveřejněn a zobrazí se v Aktualitách.' : 'The article was published and is visible in News.')
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
