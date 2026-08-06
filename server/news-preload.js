import express from 'express';
import { prisma } from './lib/prisma.js';

const originalListen = express.application.listen;

if (!express.application.__ucfrPublicNewsInstalled) {
  express.application.__ucfrPublicNewsInstalled = true;

  express.application.listen = function ucfrListenWithPublicNews(...args) {
    if (!this.__ucfrPublicNewsRouteRegistered) {
      this.__ucfrPublicNewsRouteRegistered = true;

      this.get('/api/news', async (_req, res) => {
        try {
          const articles = await prisma.document.findMany({
            where: {
              category: 'NEWS',
              status: 'PUBLISHED',
              visibility: 'PUBLIC',
            },
            orderBy: { createdAt: 'desc' },
            take: 24,
          });

          res.set('Cache-Control', 'public, max-age=30, s-maxage=120');
          return res.json(articles.map((article) => ({
            id: article.id,
            titleCs: article.titleCs,
            titleEn: article.titleEn,
            textCs: article.descriptionCs || '',
            textEn: article.descriptionEn || article.descriptionCs || '',
            imageUrl: article.url,
            publishedAt: article.createdAt,
            updatedAt: article.updatedAt,
          })));
        } catch (error) {
          console.error('Public news error:', error);
          return res.status(503).json({ error: 'News is temporarily unavailable' });
        }
      });
    }

    return originalListen.apply(this, args);
  };
}
