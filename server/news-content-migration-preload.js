import express from 'express';
import { prisma } from './lib/prisma.js';

const TARGET_TITLE = 'Fotbal bez vesnice';
const EXTERNAL_DESCRIPTION_CS = 'Externí článek – celý text se otevře na zdrojovém webu.';
const EXTERNAL_DESCRIPTION_EN = 'External article – the full text opens on the source website.';
const originalListen = express.application.listen;

async function migrateNewsContent() {
  const matches = await prisma.document.findMany({
    where: {
      OR: [
        { titleCs: { contains: TARGET_TITLE, mode: 'insensitive' } },
        { titleEn: { contains: TARGET_TITLE, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      titleCs: true,
      titleEn: true,
      descriptionCs: true,
      descriptionEn: true,
      category: true,
      status: true,
      visibility: true,
    },
  });

  if (!matches.length) {
    console.warn(`[NEWS MIGRATION] Article containing "${TARGET_TITLE}" was not found. No data changed.`);
    return;
  }

  for (const article of matches) {
    await prisma.document.update({
      where: { id: article.id },
      data: {
        titleEn: article.titleEn || article.titleCs,
        descriptionCs: article.descriptionCs || EXTERNAL_DESCRIPTION_CS,
        descriptionEn: article.descriptionEn || article.descriptionCs || EXTERNAL_DESCRIPTION_EN,
        category: 'NEWS',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
    });
    console.log(`[NEWS MIGRATION] Published in Aktuality: ${article.titleCs || article.id}`);
  }
}

async function runMigration() {
  try {
    await migrateNewsContent();
  } catch (error) {
    console.error('[NEWS MIGRATION] Background migration failed:', error);
  }
}

if (!express.application.__ucfrNewsMigrationBackgroundInstalled) {
  express.application.__ucfrNewsMigrationBackgroundInstalled = true;

  express.application.listen = function ucfrListenWithNewsMigrationBackground(...args) {
    const server = originalListen.apply(this, args);
    void runMigration();
    return server;
  };
}
