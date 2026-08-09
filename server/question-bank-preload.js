import fs from 'node:fs/promises';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { prisma } from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_BANK_PATH = path.join(__dirname, 'data', 'fotbaltesty.json');
const COMPRESSED_BANK_DIR = path.join(__dirname, 'data', 'cviceni3-bank');
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

async function loadBundledQuestionBank() {
  try {
    const names = (await fs.readdir(COMPRESSED_BANK_DIR))
      .filter((name) => /^part-\d+\.b64$/.test(name))
      .sort();

    if (names.length) {
      const encoded = (
        await Promise.all(
          names.map((name) => fs.readFile(path.join(COMPRESSED_BANK_DIR, name), 'utf8'))
        )
      ).join('').replace(/\s+/g, '');

      const json = brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8');
      const bank = JSON.parse(json);
      console.log(`[QUESTION BANK] Loaded compressed Cvičení 3 bank: ${bank.length} questions.`);
      return bank;
    }
  } catch (error) {
    console.error(
      '[QUESTION BANK] Could not load compressed Cvičení 3 bank; falling back to legacy JSON:',
      error
    );
  }

  return JSON.parse(await fs.readFile(QUESTION_BANK_PATH, 'utf8'));
}

async function syncQuestionBank() {
  const raw = await loadBundledQuestionBank();
  const bank = raw
    .filter((item) => Number(item.legacyId) >= FIRST_QUESTION_ID && Number(item.legacyId) <= LAST_QUESTION_ID)
    .sort((a, b) => Number(a.legacyId) - Number(b.legacyId));

  // Never take the whole API down just because a bundled import file is incomplete.
  // More importantly, stop before any updateMany/create/delete operation so an
  // incomplete file can never deactivate or overwrite a previously valid DB pool.
  if (bank.length !== EXPECTED_QUESTION_COUNT) {
    console.error(
      `[QUESTION BANK] Import skipped: expected ${EXPECTED_QUESTION_COUNT} questions, `
      + `but bundled source contains ${bank.length}. Existing database questions were left untouched.`
    );
    return;
  }

  for (let index = 0; index < bank.length; index += 1) {
    const expectedId = index + FIRST_QUESTION_ID;
    if (Number(bank[index].legacyId) !== expectedId) {
      console.error(`[QUESTION BANK] Import skipped: sequence is broken at question ${expectedId}. Existing DB left untouched.`);
      return;
    }

    if (!normalizeText(bank[index].textCs) || !Array.isArray(bank[index].answers) || bank[index].answers.length < 2) {
      console.error(`[QUESTION BANK] Import skipped: question ${expectedId} is incomplete. Existing DB left untouched.`);
      return;
    }

    if (bank[index].answers.filter((answer) => answer.isCorrect).length !== 1) {
      console.error(`[QUESTION BANK] Import skipped: question ${expectedId} does not have exactly one correct answer. Existing DB left untouched.`);
      return;
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

  await prisma.question.updateMany({
    where: {
      isActive: true,
      OR: [
        { legacyId: null },
        { legacyId: { lt: FIRST_QUESTION_ID } },
        { legacyId: { gt: LAST_QUESTION_ID } },
      ],
    },
    data: { isActive: false },
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
    console.error(
      `[QUESTION BANK] Database sync incomplete: expected ${EXPECTED_QUESTION_COUNT}, found ${synced.length}. `
      + 'Server will continue running.'
    );
    return;
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

  const activeQuestionCount = await prisma.question.count({
    where: { status: 'APPROVED', isActive: true },
  });

  if (activeQuestionCount !== EXPECTED_QUESTION_COUNT) {
    console.error(
      `[QUESTION BANK] Active pool check: expected ${EXPECTED_QUESTION_COUNT}, found ${activeQuestionCount}. `
      + 'Server will continue running.'
    );
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

try {
  await syncQuestionBank();
} catch (error) {
  // Question-bank maintenance must never make the whole production API unavailable.
  console.error('[QUESTION BANK] Synchronization failed; server startup will continue:', error);
}
