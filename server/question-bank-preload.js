import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_BANK_PATH = path.join(__dirname, 'data', 'fotbaltesty.json');
const FIRST_QUESTION_ID = 1;
const LAST_QUESTION_ID = 1219;
const EXPECTED_QUESTION_COUNT = LAST_QUESTION_ID - FIRST_QUESTION_ID + 1;
const SOURCE = 'Cvičení 3, Varianta 1 (04.08.2026)';
const CATEGORY_SLUG = 'zkusebny-test-cviceni-3';
const CATEGORY_NAME_CS = 'Zkušební test – Cvičení 3';
const CATEGORY_NAME_EN = 'Mock exam – Cvičení 3';

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function sameOptions(existingOptions, sourceAnswers) {
  const current = [...(existingOptions || [])].sort((a, b) => a.position - b.position);
  if (current.length !== sourceAnswers.length) return false;

  return current.every((option, index) => {
    const expected = sourceAnswers[index];
    return normalizeText(option.textCs) === normalizeText(expected.textCs)
      && normalizeText(option.textEn) === normalizeText(expected.textCs)
      && Boolean(option.isCorrect) === Boolean(expected.isCorrect)
      && Number(option.position) === index;
  });
}

async function syncQuestionBank() {
  const raw = JSON.parse(await fs.readFile(QUESTION_BANK_PATH, 'utf8'));
  const bank = raw
    .filter((item) => Number(item.legacyId) >= FIRST_QUESTION_ID && Number(item.legacyId) <= LAST_QUESTION_ID)
    .sort((a, b) => Number(a.legacyId) - Number(b.legacyId));

  if (bank.length !== EXPECTED_QUESTION_COUNT) {
    throw new Error(`Cvičení 3 question bank is incomplete: expected ${EXPECTED_QUESTION_COUNT}, found ${bank.length}.`);
  }

  for (let index = 0; index < bank.length; index += 1) {
    const expectedId = index + FIRST_QUESTION_ID;
    if (Number(bank[index].legacyId) !== expectedId) {
      throw new Error(`Cvičení 3 question bank sequence is broken at ${expectedId}.`);
    }

    if (!normalizeText(bank[index].textCs) || !Array.isArray(bank[index].answers) || bank[index].answers.length < 2) {
      throw new Error(`Cvičení 3 question ${expectedId} is incomplete.`);
    }

    if (bank[index].answers.filter((answer) => answer.isCorrect).length !== 1) {
      throw new Error(`Cvičení 3 question ${expectedId} must contain exactly one correct answer.`);
    }
  }

  const category = await prisma.category.upsert({
    where: { slug: CATEGORY_SLUG },
    update: {
      nameCs: CATEGORY_NAME_CS,
      nameEn: CATEGORY_NAME_EN,
      isActive: true,
    },
    create: {
      slug: CATEGORY_SLUG,
      nameCs: CATEGORY_NAME_CS,
      nameEn: CATEGORY_NAME_EN,
      order: 30,
      isActive: true,
    },
  });

  const legacyIds = bank.map((item) => Number(item.legacyId));
  const existing = await prisma.question.findMany({
    where: { legacyId: { in: legacyIds } },
    include: { options: true },
  });
  const existingByLegacyId = new Map(existing.map((question) => [Number(question.legacyId), question]));

  const missing = bank.filter((item) => !existingByLegacyId.has(Number(item.legacyId)));
  if (missing.length) {
    await prisma.question.createMany({
      data: missing.map((item) => ({
        legacyId: Number(item.legacyId),
        categoryId: category.id,
        textCs: normalizeText(item.textCs),
        textEn: normalizeText(item.textCs),
        explanationCs: null,
        explanationEn: null,
        difficulty: 'official',
        source: SOURCE,
        ruleReference: null,
        status: 'APPROVED',
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  const changed = bank.filter((item) => {
    const question = existingByLegacyId.get(Number(item.legacyId));
    if (!question) return false;
    return question.categoryId !== category.id
      || normalizeText(question.textCs) !== normalizeText(item.textCs)
      || normalizeText(question.textEn) !== normalizeText(item.textCs)
      || question.difficulty !== 'official'
      || question.source !== SOURCE
      || question.status !== 'APPROVED'
      || question.isActive !== true;
  });

  for (let offset = 0; offset < changed.length; offset += 50) {
    const batch = changed.slice(offset, offset + 50);
    await Promise.all(batch.map((item) => prisma.question.update({
      where: { legacyId: Number(item.legacyId) },
      data: {
        categoryId: category.id,
        textCs: normalizeText(item.textCs),
        textEn: normalizeText(item.textCs),
        difficulty: 'official',
        source: SOURCE,
        status: 'APPROVED',
        isActive: true,
      },
    })));
  }

  const synced = await prisma.question.findMany({
    where: { legacyId: { in: legacyIds } },
    include: { options: true },
  });
  const syncedByLegacyId = new Map(synced.map((question) => [Number(question.legacyId), question]));

  if (synced.length !== EXPECTED_QUESTION_COUNT) {
    throw new Error(`Database question sync is incomplete: expected ${EXPECTED_QUESTION_COUNT}, found ${synced.length}.`);
  }

  const optionsAreCurrent = bank.every((item) => {
    const question = syncedByLegacyId.get(Number(item.legacyId));
    return question && sameOptions(question.options, item.answers);
  });

  if (!optionsAreCurrent) {
    const questionIds = synced.map((question) => question.id);
    await prisma.questionOption.deleteMany({
      where: { questionId: { in: questionIds } },
    });

    const optionRows = [];
    for (const item of bank) {
      const question = syncedByLegacyId.get(Number(item.legacyId));
      item.answers.forEach((answer, position) => {
        optionRows.push({
          questionId: question.id,
          textCs: normalizeText(answer.textCs),
          textEn: normalizeText(answer.textCs),
          isCorrect: Boolean(answer.isCorrect),
          position,
        });
      });
    }

    for (let offset = 0; offset < optionRows.length; offset += 1000) {
      await prisma.questionOption.createMany({
        data: optionRows.slice(offset, offset + 1000),
      });
    }
  }

  await prisma.test.upsert({
    where: { slug: 'exam' },
    update: {
      titleCs: 'Zkušební test',
      titleEn: 'Mock examination',
      type: 'EXAM',
      questionCount: 10,
      timeLimitMinutes: 10,
      passingScore: 80,
      isPublic: true,
      isActive: true,
    },
    create: {
      slug: 'exam',
      titleCs: 'Zkušební test',
      titleEn: 'Mock examination',
      type: 'EXAM',
      questionCount: 10,
      timeLimitMinutes: 10,
      passingScore: 80,
      isPublic: true,
      isActive: true,
    },
  });

  console.log(`[QUESTION BANK] Cvičení 3 synchronized: ${EXPECTED_QUESTION_COUNT} active questions.`);
}

await syncQuestionBank();
