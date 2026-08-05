import express from 'express';
import crypto from 'node:crypto';
import { prisma } from './lib/prisma.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEB_ORIGIN = String(process.env.WEB_ORIGIN || 'https://ucfr.cz').replace(/\/$/, '');
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || '').trim();
const BREVO_SENDER_EMAIL = String(process.env.BREVO_SENDER_EMAIL || 'info@ucfr.cz').trim();
const BREVO_SENDER_NAME = String(process.env.BREVO_SENDER_NAME || 'UČFR').trim();
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const attempts = new Map();

function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function requestIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '')
    .split(',')[0]
    .trim();
}

function isRateLimited(req, email) {
  const now = Date.now();
  const key = `${requestIp(req)}:${email}`;
  const current = attempts.get(key);

  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  attempts.set(key, current);
  return current.count > RATE_LIMIT_MAX;
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
        provider: 'brevo-api',
        providerId,
        error: error ? String(error).slice(0, 1000) : null,
      },
    });
  } catch (logError) {
    console.error('Brevo reset email log error:', logError);
  }
}

function buildEmail(user, resetUrl) {
  const firstName = escapeEmailHtml(user.firstName || '');
  const safeResetUrl = escapeEmailHtml(resetUrl);

  return {
    subject: 'Obnovení hesla UČFR',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:680px;margin:0 auto;padding:24px">
        <div style="border-bottom:1px solid #e6e8ef;padding-bottom:16px;margin-bottom:20px">
          <strong style="font-size:20px">UČFR</strong>
          <div style="font-size:13px;color:#667085">Unie českých fotbalových rozhodčích</div>
        </div>
        <h1 style="font-size:22px;margin:0 0 16px">Obnovení hesla</h1>
        <p>Dobrý den${firstName ? ` ${firstName}` : ''},</p>
        <p>Obdrželi jsme žádost o nastavení nového hesla k vašemu členskému účtu UČFR.</p>
        <p>
          <a href="${safeResetUrl}" style="display:inline-block;background:#0c2848;color:#ffffff;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:700">
            Nastavit nové heslo
          </a>
        </p>
        <p>Odkaz je platný 30 minut. Pokud jste o změnu hesla nežádali, tento e-mail ignorujte.</p>
        <p style="font-size:12px;color:#667085;word-break:break-all">${safeResetUrl}</p>
      </div>
    `,
    textContent: `Pro nastavení nového hesla otevřete tento odkaz: ${resetUrl}\nOdkaz je platný 30 minut.`,
  };
}

async function sendThroughBrevo(user, resetUrl) {
  const email = buildEmail(user, resetUrl);
  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL,
      },
      to: [{
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      }],
      replyTo: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL,
      },
      subject: email.subject,
      htmlContent: email.htmlContent,
      textContent: email.textContent,
      tags: ['password-reset'],
    }),
    signal: AbortSignal.timeout(20000),
  });

  const raw = await response.text();
  let result = {};
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    result = { message: raw };
  }

  if (!response.ok) {
    const providerMessage = result?.message || result?.code || `HTTP ${response.status}`;
    throw new Error(`Brevo API: ${providerMessage}`);
  }

  if (!result?.messageId) {
    throw new Error('Brevo API nepřijalo zprávu k odeslání.');
  }

  return result.messageId;
}

async function brevoPasswordResetHandler(req, res) {
  const genericMessage = 'Pokud účet s tímto e-mailem existuje, obdržíte odkaz pro obnovení hesla.';
  let resetToken = null;
  let user = null;

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Zadejte platnou e-mailovou adresu.' });
    }

    if (isRateLimited(req, email)) {
      return res.status(429).json({
        error: 'Bylo odesláno příliš mnoho žádostí. Zkuste to znovu přibližně za 15 minut.',
      });
    }

    if (!BREVO_API_KEY) {
      return res.status(503).json({
        error: 'E-mailová služba ještě není dokončena. Správce musí v Renderu nastavit BREVO_API_KEY.',
      });
    }

    if (!EMAIL_PATTERN.test(BREVO_SENDER_EMAIL)) {
      return res.status(503).json({
        error: 'Odesílací e-mail není správně nastaven. Zkontrolujte BREVO_SENDER_EMAIL v Renderu.',
      });
    }

    user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.json({ message: genericMessage });
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    resetToken = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${WEB_ORIGIN}/reset.html?token=${encodeURIComponent(token)}`;
    const messageId = await sendThroughBrevo(user, resetUrl);

    await logResetEmail({
      userId: user.id,
      to: user.email,
      status: 'SENT',
      providerId: messageId,
    });

    return res.json({ message: genericMessage });
  } catch (error) {
    if (resetToken?.id) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {});
    }

    if (user) {
      await logResetEmail({
        userId: user.id,
        to: user.email,
        status: 'FAILED',
        error: error?.message || error,
      });
    }

    console.error('Brevo password reset error:', error);

    const message = String(error?.message || error || '');
    const senderError = /sender|not valid|not verified|unauthorized/i.test(message);
    const keyError = /key not found|api-key|unauthorized|authentication/i.test(message);

    return res.status(502).json({
      error: keyError
        ? 'Brevo API klíč není platný. Zkontrolujte BREVO_API_KEY v Renderu.'
        : senderError
          ? 'Odesílatel info@ucfr.cz není v Brevo ověřený. Dokončete ověření odesílatele.'
          : 'E-mail s odkazem se nepodařilo odeslat. Zkuste to prosím později nebo kontaktujte info@ucfr.cz.',
    });
  }
}

const previousPost = express.application.post;

if (!express.application.__ucfrBrevoPasswordResetInstalled) {
  express.application.__ucfrBrevoPasswordResetInstalled = true;

  express.application.post = function ucfrPostWithBrevo(path, ...handlers) {
    if (path === '/api/auth/forgot-password') {
      // Register directly through Route so the older Resend route is bypassed.
      this.route(path).post(brevoPasswordResetHandler);
      return this;
    }

    return previousPost.call(this, path, ...handlers);
  };
}
