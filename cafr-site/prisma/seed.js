import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questionsPath = path.join(__dirname, '../server/data/questions.json');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const slugify = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cafr.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'CAFR-change-me-2026';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'ADMIN', membershipStatus: 'APPROVED', approvedAt: new Date(), isActive: true },
    create: { email: adminEmail, passwordHash, firstName: 'ČAFR', lastName: 'Admin', role: 'ADMIN', membershipStatus: 'APPROVED', approvedAt: new Date(), isActive: true },
  });

  const rawQuestions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  const categoryNames = [...new Set(rawQuestions.map(q => q.category))];
  const categories = new Map();

  for (let i = 0; i < categoryNames.length; i += 1) {
    const name = categoryNames[i];
    const category = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { nameCs: name, nameEn: name, order: i + 1, isActive: true },
      create: { slug: slugify(name), nameCs: name, nameEn: name, order: i + 1 },
    });
    categories.set(name, category);
  }

  for (const q of rawQuestions) {
    const category = categories.get(q.category);
    const question = await prisma.question.upsert({
      where: { legacyId: Number(q.id) },
      update: {
        categoryId: category.id,
        textCs: q.cs.q,
        textEn: q.en.q,
        explanationCs: q.cs.e,
        explanationEn: q.en.e,
        difficulty: q.difficulty || 'basic',
        status: 'APPROVED',
        isActive: q.active !== false,
      },
      create: {
        legacyId: Number(q.id),
        categoryId: category.id,
        textCs: q.cs.q,
        textEn: q.en.q,
        explanationCs: q.cs.e,
        explanationEn: q.en.e,
        difficulty: q.difficulty || 'basic',
        status: 'APPROVED',
        isActive: q.active !== false,
      },
    });
    await prisma.questionOption.deleteMany({ where: { questionId: question.id } });
    await prisma.questionOption.createMany({
      data: q.cs.a.map((textCs, index) => ({
        questionId: question.id,
        textCs,
        textEn: q.en.a[index] || textCs,
        isCorrect: index === Number(q.correct),
        position: index,
      })),
    });
  }

  await prisma.test.upsert({
    where: { slug: 'practice' },
    update: { questionCount: 10, isActive: true },
    create: { slug: 'practice', titleCs: 'Procvičování', titleEn: 'Practice', type: 'PRACTICE', questionCount: 10, isPublic: true },
  });
  await prisma.test.upsert({
    where: { slug: 'exam' },
    update: { questionCount: 10, timeLimitMinutes: 10, passingScore: 80, isActive: true },
    create: { slug: 'exam', titleCs: 'Zkušební test', titleEn: 'Mock examination', type: 'EXAM', questionCount: 10, timeLimitMinutes: 10, passingScore: 80, isPublic: true },
  });



  await prisma.document.upsert({
    where: { id: 'default-stanovy-cafr' },
    update: {
      titleCs: 'Stanovy ČAFR',
      titleEn: 'ČAFR Statutes',
      descriptionCs: 'Aktualizovaný návrh stanov asociace.',
      descriptionEn: 'Updated draft statutes of the association.',
      category: 'STATUTES',
      url: '/documents/Stanovy_CAFR_aktualizovane.pdf',
      visibility: 'APPROVED_MEMBERS',
      status: 'PUBLISHED',
    },
    create: {
      id: 'default-stanovy-cafr',
      titleCs: 'Stanovy ČAFR',
      titleEn: 'ČAFR Statutes',
      descriptionCs: 'Aktualizovaný návrh stanov asociace.',
      descriptionEn: 'Updated draft statutes of the association.',
      category: 'STATUTES',
      url: '/documents/Stanovy_CAFR_aktualizovane.pdf',
      visibility: 'APPROVED_MEMBERS',
      status: 'PUBLISHED',
    },
  });


  await prisma.document.upsert({
    where: { id: 'medium-fotbal-bez-vesnice' },
    update: {
      titleCs: 'Fotbal bez vesnice: tichý rozklad hry',
      titleEn: 'Football without villages: the quiet decay of the game',
      descriptionCs: 'Externí článek Jana Markese o úbytku vesnického fotbalu, dobrovolníků a důvěry v prostředí grassroots fotbalu. Zařazeno jako tematický podklad k činnosti ČAFR.',
      descriptionEn: 'External article by Jan Markes on the decline of village football, volunteers and trust in grassroots football. Included as background material relevant to ČAFR activities.',
      category: 'ANALYSIS',
      url: 'https://medium.seznam.cz/clanek/jan-markes-fotbal-bez-vesnice-tichy-rozklad-hry-ktera-drzela-cesko-pohromade-294979',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
    },
    create: {
      id: 'medium-fotbal-bez-vesnice',
      titleCs: 'Fotbal bez vesnice: tichý rozklad hry',
      titleEn: 'Football without villages: the quiet decay of the game',
      descriptionCs: 'Externí článek Jana Markese o úbytku vesnického fotbalu, dobrovolníků a důvěry v prostředí grassroots fotbalu. Zařazeno jako tematický podklad k činnosti ČAFR.',
      descriptionEn: 'External article by Jan Markes on the decline of village football, volunteers and trust in grassroots football. Included as background material relevant to ČAFR activities.',
      category: 'ANALYSIS',
      url: 'https://medium.seznam.cz/clanek/jan-markes-fotbal-bez-vesnice-tichy-rozklad-hry-ktera-drzela-cesko-pohromade-294979',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
    },
  });

  console.log(`Seed complete: ${rawQuestions.length} questions, ${categoryNames.length} categories, admin ${adminEmail}`);
}

main().finally(() => prisma.$disconnect());
