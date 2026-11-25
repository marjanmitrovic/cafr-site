import express from 'express';
import { registrationFacrId } from './lib/member-registration.js';

const originalPost = express.application.post;
const originalUse = express.application.use;

function facrRegistrationGuard(req, res, next) {
  if (req.method !== 'POST' || registrationFacrId(req.body?.refereeStatus)) return next();
  return res.status(400).json({
    code: 'FACR_ID_REQUIRED',
    error: req.body?.language === 'en' ? 'FAČR ID is required and must contain digits only.'
      : 'ID FAČR je povinné a musí obsahovat pouze číslice.',
  });
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
