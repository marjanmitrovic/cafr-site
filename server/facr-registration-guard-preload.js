import express from 'express';
import { prisma } from './lib/prisma.js';
import { normalizeFacrId, verifyFacrMember } from './lib/facr-public.js';

const originalPost = express.application.post;
const originalUse = express.application.use;
const inFlightFacrIds = new Set();

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

function mismatchMessage(language) {
  return language === 'en'
    ? 'The FAČR ID and surname could not be verified in the public FAČR member database. Check both values.'
    : 'ID FAČR a příjmení se nepodařilo ověřit ve veřejné databázi členů FAČR. Zkontrolujte oba údaje.';
}

function unavailableMessage(language) {
  return language === 'en'
    ? 'The public FAČR member database is temporarily unavailable. Please try again later.'
    : 'Veřejná databáze členů FAČR je dočasně nedostupná. Zkuste registraci později.';
}

async function existingFacrRegistration(facrId) {
  const candidates = await prisma.user.findMany({
    where: { refereeStatus: { not: null } },
    select: { id: true, refereeStatus: true },
  });
  return candidates.find((user) => extractFacrId(user.refereeStatus) === facrId) || null;
}

async function facrRegistrationGuard(req, res, next) {
  if (req.method !== 'POST') return next();

  const language = req.body?.language === 'en' ? 'en' : 'cs';
  const facrId = extractFacrId(req.body?.refereeStatus);
  const surname = String(req.body?.lastName || '').trim();

  if (!facrId) {
    return res.status(400).json({
      error: requiredMessage(language),
      code: 'FACR_ID_REQUIRED',
    });
  }

  if (!surname) {
    return res.status(400).json({
      error: language === 'en' ? 'Surname is required for FAČR verification.' : 'Pro ověření FAČR je povinné příjmení.',
      code: 'FACR_SURNAME_REQUIRED',
    });
  }

  try {
    const duplicate = await existingFacrRegistration(facrId);
    if (duplicate || inFlightFacrIds.has(facrId)) {
      return res.status(409).json({
        error: duplicateMessage(language),
        code: 'FACR_ID_ALREADY_REGISTERED',
        facrId,
      });
    }

    const verification = await verifyFacrMember({ facrId, surname });
    if (!verification.verified) {
      const unavailable = verification.reason === 'SOURCE_UNAVAILABLE';
      return res.status(unavailable ? 503 : 422).json({
        error: unavailable ? unavailableMessage(language) : mismatchMessage(language),
        code: unavailable ? 'FACR_SOURCE_UNAVAILABLE' : 'FACR_MEMBER_NOT_VERIFIED',
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

    req.facrVerification = verification;
    return next();
  } catch (error) {
    console.error('[FAČR REGISTRATION GUARD] Verification failed:', error);
    return res.status(503).json({
      error: unavailableMessage(language),
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
