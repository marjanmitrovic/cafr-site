import express from 'express';
import { prisma } from './lib/prisma.js';

const originalPost = express.application.post;
const originalUse = express.application.use;
const inFlightFacrIds = new Set();

function normalizeFacrId(value) {
  const digits = String(value || '').trim().replace(/\D+/g, '');
  return digits.replace(/^0+(?=\d)/, '');
}

function extractFacrId(refereeStatus) {
  const match = String(refereeStatus || '').match(/ID\s*FAČR\s*:\s*([0-9]+)/i);
  return match ? normalizeFacrId(match[1]) : '';
}

function duplicateMessage(language) {
  return language === 'en'
    ? 'A registration with this FAČR ID already exists. FAČR ID must be unique.'
    : 'Registrace s tímto ID FAČR již existuje. ID FAČR musí být jedinečné.';
}

function requiredMessage(language) {
  return language === 'en'
    ? 'FAČR ID is required and must contain digits only.'
    : 'ID FAČR je povinné a musí obsahovat pouze číslice.';
}

async function facrRegistrationGuard(req, res, next) {
  if (req.method !== 'POST') return next();

  const language = req.body?.language === 'en' ? 'en' : 'cs';
  const facrId = extractFacrId(req.body?.refereeStatus);

  if (!facrId) {
    return res.status(400).json({
      error: requiredMessage(language),
      code: 'FACR_ID_REQUIRED',
    });
  }

  try {
    const candidates = await prisma.user.findMany({
      where: { refereeStatus: { not: null } },
      select: { id: true, refereeStatus: true },
    });

    const duplicate = candidates.find((user) => extractFacrId(user.refereeStatus) === facrId);
    if (duplicate || inFlightFacrIds.has(facrId)) {
      return res.status(409).json({
        error: duplicateMessage(language),
        code: 'FACR_ID_ALREADY_REGISTERED',
        facrId,
      });
    }

    // Prevent two simultaneous requests with the same FAČR ID from passing
    // the database check before the first registration is committed.
    inFlightFacrIds.add(facrId);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inFlightFacrIds.delete(facrId);
    };
    res.once('finish', release);
    res.once('close', release);

    return next();
  } catch (error) {
    console.error('[FAČR REGISTRATION GUARD] Duplicate check failed:', error);
    return res.status(503).json({
      error: language === 'en'
        ? 'Registration validation is temporarily unavailable. Please try again.'
        : 'Kontrola registrace je dočasně nedostupná. Zkuste to prosím znovu.',
      code: 'FACR_ID_CHECK_UNAVAILABLE',
    });
  }
}

if (!express.application.__ucfrFacrRegistrationGuardPatched) {
  express.application.__ucfrFacrRegistrationGuardPatched = true;

  express.application.post = function ucfrPostWithFacrGuard(path, ...handlers) {
    if (path === '/api/auth/register' && !this.__ucfrFacrRegistrationGuardInstalled) {
      this.__ucfrFacrRegistrationGuardInstalled = true;
      originalUse.call(this, '/api/auth/register', facrRegistrationGuard);
    }
    return originalPost.call(this, path, ...handlers);
  };
}
