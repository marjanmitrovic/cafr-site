import express from 'express';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { prisma } from './lib/prisma.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEB_ORIGIN = String(process.env.WEB_ORIGIN || 'https://ucfr.cz').replace(/\/$/, '');
const SMTP_HOST = String(process.env.SMTP_HOST || 'mail.endora.cz').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '');
const EMAIL_FROM = String(process.env.EMAIL_FROM || `UČFR <${SMTP_USER || 'info@ucfr.cz'}>`).trim();

function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function logResetEmail({ userId, to, status, providerId = null, error = null }) {
  try {
    await prisma.emailLog.create({
      data: {
        userId: userId || null,
        to: String(to || ''),
        subject: 'Obnovení hesla UČFR',
        type: 'PASSWORD_RESET',
        status,
        provider: 'smtp-endora',
        providerId,
        error: error ? String(error).slice(0, 1000) : null,
      },
    });
  } catch (logError) {
    console.error('SMTP reset email log error:', logError);
  }
}

function createTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    requireTLS: !SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

async function smtpPasswordResetHandler(req, res) {
  const genericMessage = 'Pokud účet s tímto e-mailem existuje, obdržíte odkaz pro obnovení hesla.';
  let resetToken = null;

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Zadejte platnou e-mailovou adresu.' });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({
        error: 'E-mailová služba není dokončena. Správce musí v Renderu nastavit SMTP_USER a SMTP_PASS.',
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.json({ message: genericMessage });
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    resetToken = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${WEB_ORIGIN}/reset.html?token=${encodeURIComponent(token)}`;
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

    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: user.email,
      subject,
      html,
      text: `Pro nastavení nového hesla otevřete tento odkaz: ${resetUrl}\nOdkaz je platný 30 minut.`,
    });

    await logResetEmail({
      userId: user.id,
      to: user.email,
      status: 'SENT',
      providerId: info.messageId || null,
    });

    return res.json({ message: genericMessage });
  } catch (error) {
    if (resetToken?.id) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {});
    }

    const recipient = String(req.body?.email || '').trim().toLowerCase();
    const user = EMAIL_PATTERN.test(recipient)
      ? await prisma.user.findUnique({ where: { email: recipient } }).catch(() => null)
      : null;

    if (user) {
      await logResetEmail({
        userId: user.id,
        to: user.email,
        status: 'FAILED',
        error: error?.message || error,
      });
    }

    console.error('Endora SMTP password reset error:', error);

    const authenticationError = ['EAUTH', '535', 'Invalid login'].some((value) =>
      String(error?.code || error?.responseCode || error?.message || '').includes(value)
    );

    return res.status(502).json({
      error: authenticationError
        ? 'Přihlášení k e-mailové schránce se nezdařilo. Zkontrolujte SMTP_USER a SMTP_PASS v Renderu.'
        : 'E-mail s odkazem se nepodařilo odeslat. Zkuste to prosím později nebo kontaktujte info@ucfr.cz.',
    });
  }
}

const previousPost = express.application.post;

if (!express.application.__ucfrEndoraSmtpPasswordResetInstalled) {
  express.application.__ucfrEndoraSmtpPasswordResetInstalled = true;

  express.application.post = function ucfrPostWithEndoraSmtp(path, ...handlers) {
    if (path === '/api/auth/forgot-password') {
      // Register directly through Route so the older Resend interceptor is bypassed.
      this.route(path).post(smtpPasswordResetHandler);
      return this;
    }

    return previousPost.call(this, path, ...handlers);
  };
}
