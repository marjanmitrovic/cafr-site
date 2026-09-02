import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './lib/prisma.js';

const originalListen = express.application.listen;
const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';
const FILE_STORAGE = String(process.env.FILE_STORAGE || 'local').toLowerCase();
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'cafr';
const NEWS_UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'documents');
const NEWS_CACHE_TTL_MS = 60 * 60 * 1000;
const allowedImageMimes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

let publicNewsCache = null;
let publicNewsCachedAt = 0;
let publicNewsInFlight = null;

function isImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return false;
  if (/\.(?:png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(url)) return true;
  try {
    const parsed = new URL(url, 'https://ucfr.cz');
    return parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/image/upload/');
  } catch {
    return false;
  }
}

function articleResponse(article) {
  const image = isImageUrl(article.url);
  return {
    id: article.id,
    titleCs: article.titleCs,
    titleEn: article.titleEn,
    textCs: article.descriptionCs || '',
    textEn: article.descriptionEn || article.descriptionCs || '',
    imageUrl: image ? article.url : '',
    externalUrl: !image ? article.url : '',
    status: article.status,
    publishedAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

async function getPublicNews() {
  const now = Date.now();
  if (Array.isArray(publicNewsCache) && now - publicNewsCachedAt < NEWS_CACHE_TTL_MS) {
    return publicNewsCache;
  }

  if (publicNewsInFlight) return publicNewsInFlight;

  publicNewsInFlight = prisma.document.findMany({
    where: {
      category: 'NEWS',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    },
    orderBy: { createdAt: 'desc' },
    take: 24,
  }).then((articles) => {
    publicNewsCache = articles.map(articleResponse);
    publicNewsCachedAt = Date.now();
    return publicNewsCache;
  }).finally(() => {
    publicNewsInFlight = null;
  });

  return publicNewsInFlight;
}

function invalidatePublicNewsCache() {
  publicNewsCache = null;
  publicNewsCachedAt = 0;
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function sanitizeFileName(name) {
  return String(name || 'article-image')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'article-image';
}

async function requireNewsAdmin(req, res) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive || !['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return null;
    }

    return user;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

async function uploadNewsImage(fileName, fileData) {
  const decoded = decodeDataUrl(fileData);
  if (!decoded || !allowedImageMimes.has(decoded.mime)) {
    throw new Error('Unsupported image type. Use JPG, PNG or WEBP.');
  }

  if (decoded.buffer.length > 8 * 1024 * 1024) {
    const error = new Error('Image is too large. Maximum is 8 MB.');
    error.statusCode = 413;
    throw error;
  }

  const cleanName = sanitizeFileName(fileName);
  const extension = path.extname(cleanName).toLowerCase() || allowedImageMimes.get(decoded.mime);
  const baseName = sanitizeFileName(path.basename(cleanName, path.extname(cleanName)) || 'article-image');
  const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${baseName}${extension}`;

  if (FILE_STORAGE === 'cloudinary') {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error('Cloudinary storage is not configured.');
    }

    const form = new FormData();
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    form.append('folder', [CLOUDINARY_FOLDER, 'news'].filter(Boolean).join('/'));
    form.append('public_id', path.basename(storedName, extension));
    form.append('file', new Blob([decoded.buffer], { type: decoded.mime }), storedName);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error?.message || 'Image upload failed.');
    }

    return data.secure_url || data.url;
  }

  await fs.mkdir(NEWS_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(NEWS_UPLOAD_DIR, storedName), decoded.buffer);
  return `/uploads/documents/${storedName}`;
}

if (!express.application.__ucfrPublicNewsInstalled) {
  express.application.__ucfrPublicNewsInstalled = true;

  express.application.listen = function ucfrListenWithPublicNews(...args) {
    if (!this.__ucfrPublicNewsRouteRegistered) {
      this.__ucfrPublicNewsRouteRegistered = true;

      this.get('/api/news', async (_req, res) => {
        try {
          const articles = await getPublicNews();
          res.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
          return res.json(articles);
        } catch (error) {
          console.error('Public news error:', error);
          return res.status(503).json({ error: 'News is temporarily unavailable' });
        }
      });

      this.patch('/api/admin/news/:id', async (req, res) => {
        const user = await requireNewsAdmin(req, res);
        if (!user) return;

        try {
          const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
          if (!existing || existing.category !== 'NEWS') {
            return res.status(404).json({ error: 'Article not found' });
          }

          const titleCs = String(req.body?.titleCs || '').trim();
          const titleEn = String(req.body?.titleEn || titleCs).trim();
          const textCs = String(req.body?.descriptionCs || '').trim();
          const textEn = String(req.body?.descriptionEn || textCs).trim();
          const status = String(req.body?.status || existing.status);

          if (!titleCs || !textCs) {
            return res.status(400).json({ error: 'Article title and text are required' });
          }
          if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid article status' });
          }

          let imageUrl = existing.url;
          if (req.body?.fileData || req.body?.fileName) {
            if (!req.body?.fileData || !req.body?.fileName) {
              return res.status(400).json({ error: 'Both fileName and fileData are required' });
            }
            imageUrl = await uploadNewsImage(req.body.fileName, req.body.fileData);
          }

          const article = await prisma.document.update({
            where: { id: existing.id },
            data: {
              titleCs,
              titleEn: titleEn || titleCs,
              descriptionCs: textCs,
              descriptionEn: textEn || textCs,
              category: 'NEWS',
              visibility: 'PUBLIC',
              status,
              url: imageUrl,
              createdById: existing.createdById || user.id,
            },
          });

          invalidatePublicNewsCache();
          res.set('Cache-Control', 'no-store');
          return res.json({ article: articleResponse(article) });
        } catch (error) {
          console.error('Update news article error:', error);
          return res.status(error.statusCode || 500).json({ error: error.message || 'Could not update article' });
        }
      });
    }

    return originalListen.apply(this, args);
  };
}
