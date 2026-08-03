import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma.js';

const REQUIRED_REGISTRATION_ADMIN_EMAILS = Object.freeze([
  'marapleskac@gmail.com',
  'unierozhodcich@gmail.com',
]);

function normalizedEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const notificationEmails = [...new Set([
  ...normalizedEmails(process.env.ADMIN_NOTIFY_EMAIL),
  ...normalizedEmails(process.env.ADMIN_EMAIL),
  ...REQUIRED_REGISTRATION_ADMIN_EMAILS,
])];

process.env.ADMIN_NOTIFY_EMAIL = notificationEmails.join(',');
process.env.ASSOCIATION_ICO = '24417513';

const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';
const ADMIN_ROLES = new Set(['ADMIN', 'BOARD', 'QUESTION_EDITOR']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FAČR_PATTERN = /(?:^|\|)\s*(?:ID\s*)?FAČR\s*:\s*([0-9]+)\s*(?:\||$)/i;
const LIST_PATTERN = /(?:^|\|)\s*(?:Listina|Soutěž|Referee list)\s*:\s*([^|]+)\s*(?:\||$)/i;

function publicMember(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    region: user.region,
    refereeStatus: user.refereeStatus,
    role: user.role,
    membershipStatus: user.membershipStatus,
    language: user.language,
    isActive: user.isActive,
    approvedAt: user.approvedAt,
    createdAt: user.createdAt,
  };
}

async function requireMemberEditor(req, res) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) {
    res.status(401).json({ error: 'Chybí administrátorské oprávnění.' });
    return null;
  }

  try {
    const payload = jwt.verify(token, TOKEN_SECRET);
    const administrator = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!administrator || !administrator.isActive || !ADMIN_ROLES.has(administrator.role)) {
      res.status(403).json({ error: 'K úpravě přihlášky nemáte oprávnění.' });
      return null;
    }

    return administrator;
  } catch {
    res.status(401).json({ error: 'Administrátorské přihlášení vypršelo. Přihlaste se znovu.' });
    return null;
  }
}

const originalListen = express.application.listen;

if (!express.application.__ucfrPendingMemberEditorInstalled) {
  express.application.__ucfrPendingMemberEditorInstalled = true;

  express.application.listen = function ucfrListenWithPendingMemberEditor(...args) {
    if (!this.__ucfrPendingMemberEditorRouteRegistered) {
      this.__ucfrPendingMemberEditorRouteRegistered = true;

      this.patch('/api/admin/users/:id/profile', async (req, res) => {
        const administrator = await requireMemberEditor(req, res);
        if (!administrator) return;

        try {
          const current = await prisma.user.findUnique({ where: { id: String(req.params.id) } });

          if (!current) {
            return res.status(404).json({ error: 'Přihláška nebyla nalezena.' });
          }

          if (current.membershipStatus !== 'PENDING') {
            return res.status(409).json({
              error: 'Údaje lze touto funkcí upravit pouze před schválením členství.',
            });
          }

          const firstName = String(req.body?.firstName || '').trim();
          const lastName = String(req.body?.lastName || '').trim();
          const email = String(req.body?.email || '').trim().toLowerCase();
          const phone = String(req.body?.phone || '').trim();
          const region = String(req.body?.region || '').trim();
          const refereeStatus = String(req.body?.refereeStatus || '').trim();

          if (!firstName || !lastName || !email || !phone || !region || !refereeStatus) {
            return res.status(400).json({
              error: 'Vyplňte všechna povinná pole před uložením přihlášky.',
            });
          }

          if (!EMAIL_PATTERN.test(email)) {
            return res.status(400).json({ error: 'Zadejte platnou e-mailovou adresu.' });
          }

          if (!FAČR_PATTERN.test(refereeStatus)) {
            return res.status(400).json({ error: 'ID FAČR je povinné a může obsahovat pouze číslice.' });
          }

          if (!LIST_PATTERN.test(refereeStatus)) {
            return res.status(400).json({ error: 'Vyberte listinu rozhodčích.' });
          }

          const updated = await prisma.user.update({
            where: { id: current.id },
            data: {
              firstName,
              lastName,
              email,
              phone,
              region,
              refereeStatus,
            },
          });

          return res.json({ user: publicMember(updated) });
        } catch (error) {
          if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'Tento e-mail je již použit u jiného účtu.' });
          }

          console.error('Pending member profile update error:', error);
          return res.status(500).json({ error: 'Údaje přihlášky se nepodařilo uložit.' });
        }
      });
    }

    return originalListen.apply(this, args);
  };
}
