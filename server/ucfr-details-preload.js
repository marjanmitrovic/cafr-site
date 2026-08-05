import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { Resend } from 'resend';
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
const PASSWORD_RESET_ORIGIN = String(process.env.WEB_ORIGIN || 'https://ucfr.cz').replace(/\/$/, '');
const PASSWORD_RESET_FROM = String(process.env.EMAIL_FROM || 'UČFR <info@ucfr.cz>').trim();
const passwordResetResend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function logPasswordResetEmail({ userId, to, status, providerId = null, error = null }) {
  try {
    await prisma.emailLog.create({
      data: {
        userId: userId || null,
        to: String(to || ''),
        subject: 'Obnovení hesla UČFR',
        type: 'PASSWORD_RESET',
        status,
        provider: 'resend',
        providerId,
        error: error ? String(error).slice(0, 1000) : null,
      },
    });
  } catch (logError) {
    console.error('Password reset email log error:', logError);
  }
}

async function passwordResetHandler(req, res) {
  const genericMessage = 'Pokud účet s tímto e-mailem existuje, obdržíte odkaz pro obnovení hesla.';

  try {
    if (process.env.EMAIL_DISABLED === 'true') {
      return res.status(503).json({
        error: 'Odesílání e-mailů je dočasně vypnuté. Kontaktujte prosím info@ucfr.cz.',
      });
    }

    if (!passwordResetResend) {
      return res.status(503).json({
        error: 'E-mailová služba není nakonfigurována. Kontaktujte prosím info@ucfr.cz.',
      });
    }

    if (process.env.NODE_ENV === 'production' && /onboarding@resend\.dev/i.test(PASSWORD_RESET_FROM)) {
      return res.status(503).json({
        error: 'Odesílatel pro obnovení hesla není správně nastaven. Kontaktujte prosím info@ucfr.cz.',
      });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return res.json({ message: genericMessage });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.json({ message: genericMessage });
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const resetToken = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${PASSWORD_RESET_ORIGIN}/reset.html?token=${encodeURIComponent(token)}`;
    const subject = 'Obnovení hesla UČFR';
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:680px;margin:0 auto;padding:24px">
        <div style="border-bottom:1px solid #e6e8ef;padding-bottom:16px;margin-bottom:20px">
          <strong style="font-size:20px">UČFR</strong>
          <div style="font-size:13px;color:#667085">Unie českých fotbalových rozhodčích</div>
        </div>
        <h1 style="font-size:22px;margin:0 0 16px">Obnovení hesla</h1>
        <p>Dobrý den ${escapeEmailHtml(user.firstName)},</p>
        <p>Obdrželi jsme žádost o nastavení nového hesla k vašemu členskému účtu UČFR.</p>
        <p>
          <a href="${escapeEmailHtml(resetUrl)}" style="display:inline-block;background:#0c2848;color:#ffffff;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:700">
            Nastavit nové heslo
          </a>
        </p>
        <p>Odkaz je platný 30 minut. Pokud jste o změnu hesla nežádali, tento e-mail ignorujte.</p>
        <p style="font-size:12px;color:#667085;word-break:break-all">${escapeEmailHtml(resetUrl)}</p>
      </div>
    `;

    const delivery = await passwordResetResend.emails.send({
      from: PASSWORD_RESET_FROM,
      to: [user.email],
      subject,
      html,
      text: `Pro nastavení nového hesla otevřete tento odkaz: ${resetUrl}\nOdkaz je platný 30 minut.`,
    });

    if (delivery?.error) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {});
      await logPasswordResetEmail({
        userId: user.id,
        to: user.email,
        status: 'FAILED',
        error: delivery.error.message || JSON.stringify(delivery.error),
      });
      console.error('Password reset email provider error:', delivery.error);
      return res.status(502).json({
        error: 'E-mail s odkazem se nepodařilo odeslat. Zkontrolujte adresu nebo kontaktujte info@ucfr.cz.',
      });
    }

    const providerId = delivery?.data?.id || delivery?.id || null;
    await logPasswordResetEmail({
      userId: user.id,
      to: user.email,
      status: 'SENT',
      providerId,
    });

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      error: 'Požadavek na obnovení hesla se nepodařilo zpracovat. Zkuste to prosím později.',
    });
  }
}

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

const originalPost = express.application.post;

if (!express.application.__ucfrPasswordResetRouteInstalled) {
  express.application.__ucfrPasswordResetRouteInstalled = true;

  express.application.post = function ucfrPostWithPasswordReset(path, ...handlers) {
    if (path === '/api/auth/forgot-password') {
      return originalPost.call(this, path, passwordResetHandler);
    }

    return originalPost.call(this, path, ...handlers);
  };
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
