import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './lib/prisma.js';

const PORT = Number(process.env.API_PORT || 3001);
const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const DOCUMENT_UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'documents');
const EVIDENCE_UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'evidence');
const FILE_STORAGE = String(process.env.FILE_STORAGE || 'local').toLowerCase();
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'cafr';

app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));


const WEB_ORIGIN = String(process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
const EMAIL_FROM = process.env.EMAIL_FROM || 'ČAFR <onboarding@resend.dev>';
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'marjan.posao@gmail.com';

// Resend SDK client. Replace RESEND_API_KEY="re_xxxxxxxxx" in .env with your real Resend API key.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const escapeEmailHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const emailLayout = (title, bodyHtml) => `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033;max-width:680px;margin:0 auto;padding:24px">
    <div style="border-bottom:1px solid #e6e8ef;padding-bottom:16px;margin-bottom:20px">
      <strong style="font-size:20px">ČAFR</strong>
      <div style="font-size:13px;color:#667085">Česká asociace fotbalových rozhodčích</div>
    </div>
    <h1 style="font-size:22px;margin:0 0 16px">${escapeEmailHtml(title)}</h1>
    <div style="font-size:15px">${bodyHtml}</div>
    <p style="margin-top:28px;font-size:12px;color:#667085">Tento email byl odeslán automaticky systémem ČAFR.</p>
  </div>
`;

async function logEmail({ to, subject, type, status, provider, providerId, error, userId }) {
  try {
    await prisma.emailLog.create({
      data: {
        to: String(to || ''),
        subject: String(subject || ''),
        type: type || null,
        status: String(status || 'PENDING'),
        provider: provider || null,
        providerId: providerId || null,
        error: error ? String(error).slice(0, 1000) : null,
        userId: userId || null,
      },
    });
  } catch (logError) {
    console.error('Email log error:', logError);
  }
}

async function sendEmail({ to, subject, html, text, type, userId }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) return { skipped: true, reason: 'NO_RECIPIENTS' };

  if (process.env.EMAIL_DISABLED === 'true' || !resend) {
    console.log('[EMAIL SKIPPED]', { to: recipients, subject, type });
    await Promise.all(recipients.map((recipient) => logEmail({
      to: recipient,
      subject,
      type,
      status: 'SKIPPED',
      provider: resend ? 'resend-disabled' : 'none',
      error: resend ? 'EMAIL_DISABLED=true' : 'RESEND_API_KEY is not configured. Replace re_xxxxxxxxx in .env with your real API key.',
      userId,
    })));
    return { skipped: true };
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject,
      html,
      text: text || subject,
    });

    const providerId = result?.data?.id || result?.id || null;

    await Promise.all(recipients.map((recipient) => logEmail({
      to: recipient,
      subject,
      type,
      status: 'SENT',
      provider: 'resend',
      providerId,
      userId,
    })));

    return result;
  } catch (error) {
    console.error('Email send error:', error);
    await Promise.all(recipients.map((recipient) => logEmail({
      to: recipient,
      subject,
      type,
      status: 'FAILED',
      provider: 'resend',
      error: error.message,
      userId,
    })));
    return { failed: true, error: error.message };
  }
}

async function sendAdminEmail(subject, bodyHtml, type) {
  return sendEmail({
    to: ADMIN_NOTIFY_EMAIL,
    subject,
    html: emailLayout(subject, bodyHtml),
    text: subject,
    type,
  });
}

async function sendMemberEmail(user, subject, bodyHtml, type) {
  if (!user?.email) return { skipped: true };
  return sendEmail({
    to: user.email,
    subject,
    html: emailLayout(subject, bodyHtml),
    text: subject,
    type,
    userId: user.id,
  });
}

const requireAdmin = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};


const requireAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const publicUser = user => ({
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
});

const publicQuestion = (q, lang) => ({
  id: q.id,
  category: lang === 'en' ? q.category.nameEn : q.category.nameCs,
  difficulty: q.difficulty,
  [lang]: {
    q: lang === 'en' ? q.textEn : q.textCs,
    a: q.options.sort((a, b) => a.position - b.position).map(o => lang === 'en' ? o.textEn : o.textCs),
  },
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'cafr-api', database: 'neon-postgresql' });
  } catch (error) {
    res.status(503).json({ ok: false, service: 'cafr-api', database: 'unavailable', error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/test-email', async (request, response) => {
    const result = await sendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || 'marjan.posao@gmail.com',
      subject: 'Hello World',
      html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
      type: 'TEST',
    });

    response.json(result);
  });
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, region, refereeStatus, language = 'cs' } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password || !firstName || !lastName) return res.status(400).json({ error: 'Email, password, firstName and lastName are required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must contain at least 8 characters' });
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) return res.status(409).json({ error: 'An account with this email already exists' });
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(String(password), 12),
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        phone: phone ? String(phone).trim() : null,
        region: region ? String(region).trim() : null,
        refereeStatus: refereeStatus ? String(refereeStatus).trim() : null,
        language: language === 'en' ? 'en' : 'cs',
        role: 'MEMBER',
        membershipStatus: 'PENDING',
        isActive: true,
      },
    });
    await sendMemberEmail(
      user,
      'Přihláška ČAFR přijata',
      `<p>Dobrý den ${escapeEmailHtml(user.firstName)},</p><p>Vaše členská přihláška byla přijata a čeká na schválení Výkonným výborem.</p><p>Stav můžete sledovat po přihlášení v členském dashboardu.</p>`,
      'REGISTRATION_RECEIVED'
    );

    await sendAdminEmail(
      'Nová členská přihláška ČAFR',
      `<p>Nová přihláška čeká na schválení.</p><p><b>${escapeEmailHtml(user.firstName)} ${escapeEmailHtml(user.lastName)}</b><br>${escapeEmailHtml(user.email)}<br>${escapeEmailHtml(user.region || '')}</p><p><a href="${WEB_ORIGIN}/">Otevřít administraci</a></p>`,
      'ADMIN_NEW_MEMBER'
    );

    res.status(201).json({ message: 'Registration submitted', user: publicUser(user) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ sub: user.id, role: user.role, membershipStatus: user.membershipStatus }, TOKEN_SECRET, { expiresIn: '7d' });
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, region, refereeStatus, language } = req.body || {};
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName !== undefined && { firstName: String(firstName).trim() }),
        ...(lastName !== undefined && { lastName: String(lastName).trim() }),
        ...(phone !== undefined && { phone: phone ? String(phone).trim() : null }),
        ...(region !== undefined && { region: region ? String(region).trim() : null }),
        ...(refereeStatus !== undefined && { refereeStatus: refereeStatus ? String(refereeStatus).trim() : null }),
        ...(language !== undefined && { language: language === 'en' ? 'en' : 'cs' }),
      },
    });
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Could not update profile' });
  }
});

app.patch('/api/auth/password', requireAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Current password and a new password with at least 8 characters are required' });
    }

    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });

    await prisma.passwordResetToken.updateMany({
      where: { userId: req.user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    res.json({ ok: true, message: 'Password changed' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Could not change password' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const generic = { message: 'If the account exists, password reset instructions have been created.' };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.json(generic);

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${WEB_ORIGIN}/reset.html?token=${encodeURIComponent(token)}`;

    await sendMemberEmail(
      user,
      'Obnovení hesla ČAFR',
      `<p>Dobrý den ${escapeEmailHtml(user.firstName)},</p><p>Pro nastavení nového hesla otevřete tento odkaz. Odkaz platí 30 minut.</p><p><a href="${escapeEmailHtml(resetUrl)}" style="display:inline-block;background:#172033;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none">Nastavit nové heslo</a></p><p style="word-break:break-all">${escapeEmailHtml(resetUrl)}</p>`,
      'PASSWORD_RESET'
    );

    res.json({ ...generic, ...(process.env.NODE_ENV === 'production' ? {} : { resetUrl }) });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Could not create password reset request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!token || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid token and a password with at least 8 characters are required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      return res.status(400).json({ error: 'Reset link is invalid or expired' });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await bcrypt.hash(newPassword, 12) },
      }),
      prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ ok: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

app.get('/api/questions', async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'cs';
  const count = Math.max(1, Math.min(Number(req.query.count || 10), 40));
  const category = String(req.query.category || '').trim();
  const where = { isActive: true, status: 'APPROVED' };
  if (category) where.category = { OR: [{ nameCs: category }, { nameEn: category }, { slug: category }] };
  const rows = await prisma.question.findMany({ where, include: { category: true, options: true } });
  rows.sort(() => Math.random() - 0.5);
  res.json(rows.slice(0, count).map(q => publicQuestion(q, lang)));
});

app.post('/api/check-answer', async (req, res) => {
  const { questionId, answer, lang = 'cs' } = req.body || {};
  const question = await prisma.question.findFirst({
    where: { id: String(questionId), isActive: true, status: 'APPROVED' },
    include: { options: true },
  });
  if (!question) return res.status(404).json({ error: 'Question not found' });
  const options = question.options.sort((a, b) => a.position - b.position);
  const selected = Number(answer);
  const correct = options.findIndex(o => o.isCorrect);
  res.json({
    isCorrect: selected === correct,
    correct,
    explanation: lang === 'en' ? question.explanationEn : question.explanationCs,
  });
});

app.post('/api/attempts', async (req, res) => {
  const { mode = 'practice', lang = 'cs', answers = [], questionIds = [], duration = 0, userId = 'guest' } = req.body || {};
  const selected = await prisma.question.findMany({
    where: { id: { in: questionIds.map(String) }, isActive: true },
    include: { options: true },
  });
  const byId = new Map(selected.map(q => [q.id, q]));
  const ordered = questionIds.map(id => byId.get(String(id))).filter(Boolean);
  if (!ordered.length || ordered.length !== questionIds.length) return res.status(400).json({ error: 'Invalid question set' });

  const test = await prisma.test.findUnique({ where: { slug: mode === 'exam' ? 'exam' : 'practice' } });
  if (!test) return res.status(500).json({ error: 'Test configuration missing. Run npm run db:seed.' });

  const review = ordered.map((q, i) => {
    const options = q.options.sort((a, b) => a.position - b.position);
    const correct = options.findIndex(o => o.isCorrect);
    return {
      id: q.id,
      selected: answers[i] ?? null,
      correct,
      isCorrect: Number(answers[i]) === correct,
      explanation: lang === 'en' ? q.explanationEn : q.explanationCs,
      selectedOptionId: options[Number(answers[i])]?.id || null,
    };
  });
  const correct = review.filter(x => x.isCorrect).length;
  const total = ordered.length;
  const percent = Math.round((correct / total) * 100);
  const startedAt = new Date(Date.now() - (Number(duration) || 0) * 1000);

  const knownUser = userId !== 'guest' ? await prisma.user.findUnique({ where: { id: String(userId) } }) : null;
  const attempt = await prisma.attempt.create({
    data: {
      userId: knownUser?.id || null,
      guestKey: knownUser ? null : String(userId || 'guest'),
      testId: test.id,
      mode,
      score: percent,
      correctAnswers: correct,
      totalQuestions: total,
      durationSeconds: Number(duration) || 0,
      passed: test.passingScore == null ? null : percent >= test.passingScore,
      startedAt,
      answers: {
        create: review.map((r, i) => ({
          questionId: ordered[i].id,
          selectedOptionId: r.selectedOptionId,
          isCorrect: r.isCorrect,
        })),
      },
    },
  });

  res.json({
    attempt: { id: attempt.id, userId, mode, correct, total, percent, duration: attempt.durationSeconds, createdAt: attempt.finishedAt },
    review: review.map(({ selectedOptionId, isCorrect, ...r }) => r),
  });
});

app.get('/api/results/:userId', async (req, res) => {
  const key = req.params.userId;
  const rows = await prisma.attempt.findMany({
    where: { OR: [{ userId: key }, { guestKey: key }] },
    orderBy: { finishedAt: 'desc' },
    take: 50,
  });
  res.json(rows.map(a => ({
    id: a.id,
    userId: key,
    mode: a.mode,
    correct: a.correctAnswers,
    total: a.totalQuestions,
    percent: Math.round(a.score),
    duration: a.durationSeconds,
    createdAt: a.finishedAt,
  })));
});

app.get('/api/admin/questions', requireAdmin, async (_req, res) => {
  const rows = await prisma.question.findMany({ include: { category: true, options: true }, orderBy: { createdAt: 'desc' } });
  res.json(rows.map(q => {
    const options = q.options.sort((a, b) => a.position - b.position);
    return {
      id: q.id,
      category: q.category.nameCs,
      difficulty: q.difficulty,
      active: q.isActive,
      correct: options.findIndex(o => o.isCorrect),
      cs: { q: q.textCs, a: options.map(o => o.textCs), e: q.explanationCs || '' },
      en: { q: q.textEn, a: options.map(o => o.textEn), e: q.explanationEn || '' },
    };
  }));
});

app.post('/api/admin/questions', requireAdmin, async (req, res) => {
  const q = req.body || {};
  if (!q.category || !q.cs?.q || !Array.isArray(q.cs?.a) || q.cs.a.length < 2 || !q.en?.q || !Array.isArray(q.en?.a) || q.en.a.length < 2 || !Number.isInteger(q.correct)) {
    return res.status(400).json({ error: 'Incomplete question' });
  }
  const slug = q.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const category = await prisma.category.upsert({
    where: { slug },
    update: { nameCs: q.category, isActive: true },
    create: { slug, nameCs: q.category, nameEn: q.category },
  });
  const item = await prisma.question.create({
    data: {
      categoryId: category.id,
      textCs: q.cs.q,
      textEn: q.en.q,
      explanationCs: q.cs.e || null,
      explanationEn: q.en.e || null,
      difficulty: q.difficulty || 'basic',
      status: 'APPROVED',
      isActive: q.active !== false,
      createdById: req.user.id,
      options: {
        create: q.cs.a.map((textCs, index) => ({
          textCs,
          textEn: q.en.a[index] || textCs,
          isCorrect: index === q.correct,
          position: index,
        })),
      },
    },
  });
  res.status(201).json({ id: item.id });
});

app.patch('/api/admin/questions/:id', requireAdmin, async (req, res) => {
  const data = {};
  if (typeof req.body.active === 'boolean') data.isActive = req.body.active;
  if (req.body.difficulty) data.difficulty = req.body.difficulty;
  try {
    const q = await prisma.question.update({ where: { id: req.params.id }, data });
    res.json({ id: q.id, active: q.isActive });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

app.delete('/api/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.question.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});



app.get('/api/notifications/me', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  res.json({ notifications, unreadCount });
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    res.json({ notification });
  } catch {
    res.status(404).json({ error: 'Notification not found' });
  }
});

app.patch('/api/notifications/read-all', requireAuth, async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ updated: result.count });
});

app.post('/api/incidents', requireAuth, async (req, res) => {
  try {
    const { incidentDate, matchInfo, competition, location, incidentType, description, urgency = 'NORMAL', contactPreference, attachments = [] } = req.body || {};
    if (!incidentDate || !matchInfo || !incidentType || !description) {
      return res.status(400).json({ error: 'incidentDate, matchInfo, incidentType and description are required' });
    }
    const allowedUrgency = ['NORMAL', 'HIGH', 'CRITICAL'];
    const savedAttachments = await saveEvidenceAttachments(attachments, 'incidents');
    const incident = await prisma.incident.create({
      data: {
        userId: req.user.id,
        incidentDate: new Date(incidentDate),
        matchInfo: String(matchInfo).trim(),
        competition: competition ? String(competition).trim() : null,
        location: location ? String(location).trim() : null,
        incidentType: String(incidentType).trim(),
        description: String(description).trim(),
        urgency: allowedUrgency.includes(String(urgency)) ? String(urgency) : 'NORMAL',
        contactPreference: contactPreference ? String(contactPreference).trim() : null,
        attachments: savedAttachments.length ? { create: savedAttachments } : undefined,
        events: {
          create: {
            actorId: req.user.id,
            type: 'CREATED',
            message: savedAttachments.length ? `Incident created with ${savedAttachments.length} attachment(s)` : 'Incident created',
            newStatus: 'NEW',
          },
        },
      },
      include: { attachments: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    await sendAdminEmail(
      'Nový incident ČAFR',
      `<p>Člen odeslal nový incident.</p><p><b>${escapeEmailHtml(req.user.firstName)} ${escapeEmailHtml(req.user.lastName)}</b><br>${escapeEmailHtml(req.user.email)}</p><p><b>${escapeEmailHtml(incident.incidentType)}</b><br>${escapeEmailHtml(incident.matchInfo)}</p><p><a href="${WEB_ORIGIN}/">Otevřít administraci</a></p>`,
      'ADMIN_NEW_INCIDENT'
    );

    return res.status(201).json({ incident });
  } catch (error) {
    console.error('Create incident error:', error);
    return res.status(500).json({ error: 'Could not save incident' });
  }
});

app.get('/api/incidents/me', requireAuth, async (req, res) => {
  const incidents = await prisma.incident.findMany({
    where: { userId: req.user.id },
    include: {
      attachments: { orderBy: { createdAt: 'asc' } },
      events: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, message: true, oldStatus: true, newStatus: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(incidents);
});

app.get('/api/admin/incidents', requireAdmin, async (_req, res) => {
  const incidents = await prisma.incident.findMany({
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, region: true },
      },
      attachments: { orderBy: { createdAt: 'asc' } },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
    },
    orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(incidents);
});

app.patch('/api/admin/incidents/:id', requireAdmin, async (req, res) => {
  const allowedStatus = ['NEW', 'IN_REVIEW', 'CONTACTED', 'RESOLVED', 'CLOSED'];

  try {
    const current = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Incident not found' });

    const data = {};
    let nextStatus = current.status;
    let noteChanged = false;

    if (req.body?.status !== undefined) {
      nextStatus = String(req.body.status);
      if (!allowedStatus.includes(nextStatus)) return res.status(400).json({ error: 'Invalid incident status' });
      data.status = nextStatus;
    }

    if (req.body?.adminNote !== undefined) {
      data.adminNote = req.body.adminNote ? String(req.body.adminNote).trim() : null;
      noteChanged = data.adminNote !== current.adminNote;
    }

    const statusChanged = nextStatus !== current.status;
    const eventMessage = noteChanged ? data.adminNote : null;

    const incident = await prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({ where: { id: req.params.id }, data });

      if (statusChanged || noteChanged) {
        await tx.incidentEvent.create({
          data: {
            incidentId: current.id,
            actorId: req.user.id,
            type: statusChanged && noteChanged ? 'STATUS_AND_NOTE' : statusChanged ? 'STATUS_CHANGED' : 'ADMIN_NOTE',
            message: eventMessage,
            oldStatus: statusChanged ? current.status : null,
            newStatus: statusChanged ? nextStatus : null,
          },
        });

        await tx.notification.create({
          data: {
            userId: current.userId,
            type: 'INCIDENT_UPDATE',
            title: 'Aktualizace incidentu',
            message: statusChanged
              ? `Stav vašeho incidentu byl změněn z ${current.status} na ${nextStatus}.`
              : 'ČAFR přidal novou odpověď k vašemu incidentu.',
            link: '/dashboard.html#incidents',
          },
        });
      }

      return updated;
    });

    const fullIncident = await prisma.incident.findUnique({
      where: { id: incident.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, region: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { firstName: true, lastName: true, role: true } } } },
      },
    });

    if (statusChanged || noteChanged) {
      await sendMemberEmail(
        fullIncident.user,
        'Aktualizace incidentu ČAFR',
        `<p>Dobrý den ${escapeEmailHtml(fullIncident.user.firstName)},</p><p>Váš incident byl aktualizován.</p><p><b>Stav:</b> ${escapeEmailHtml(fullIncident.status)}</p>${fullIncident.adminNote ? `<p><b>Odpověď ČAFR:</b><br>${escapeEmailHtml(fullIncident.adminNote)}</p>` : ''}<p><a href="${WEB_ORIGIN}/dashboard.html#incidents">Otevřít incidenty</a></p>`,
        'INCIDENT_UPDATE'
      );
    }

    res.json({ incident: fullIncident });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ error: 'Could not update incident' });
  }
});



const seminarResponse = (seminar, userId = null) => ({
  id: seminar.id,
  titleCs: seminar.titleCs,
  titleEn: seminar.titleEn,
  descriptionCs: seminar.descriptionCs,
  descriptionEn: seminar.descriptionEn,
  location: seminar.location,
  startsAt: seminar.startsAt,
  endsAt: seminar.endsAt,
  capacity: seminar.capacity,
  status: seminar.status,
  registrationCount: seminar._count?.registrations ?? seminar.registrations?.filter((item) => item.status === 'REGISTERED').length ?? 0,
  myRegistration: userId ? seminar.registrations?.find((item) => item.userId === userId) || null : null,
});

app.get('/api/seminars', requireAuth, async (req, res) => {
  try {
    const seminars = await prisma.seminar.findMany({
      where: { status: { in: ['PUBLISHED', 'COMPLETED'] } },
      include: {
        registrations: { where: { OR: [{ userId: req.user.id }, { status: 'REGISTERED' }] }, select: { id: true, userId: true, status: true } },
        _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
      },
      orderBy: { startsAt: 'asc' },
    });
    res.json(seminars.map((item) => seminarResponse(item, req.user.id)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seminars/:id/register', requireAuth, async (req, res) => {
  try {
    if (req.user.membershipStatus !== 'APPROVED') return res.status(403).json({ error: 'Membership approval is required' });
    const seminar = await prisma.seminar.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: { where: { status: 'REGISTERED' } } } } },
    });
    if (!seminar || seminar.status !== 'PUBLISHED') return res.status(404).json({ error: 'Seminar is not available' });
    if (seminar.startsAt <= new Date()) return res.status(400).json({ error: 'Registration is closed' });
    if (seminar.capacity && seminar._count.registrations >= seminar.capacity) return res.status(409).json({ error: 'Seminar capacity is full' });

    const registration = await prisma.seminarRegistration.upsert({
      where: { seminarId_userId: { seminarId: seminar.id, userId: req.user.id } },
      update: { status: 'REGISTERED' },
      create: { seminarId: seminar.id, userId: req.user.id, status: 'REGISTERED' },
    });
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        type: 'SEMINAR_REGISTRATION',
        title: 'Přihlášení na seminář',
        message: `Byli jste přihlášeni na seminář: ${seminar.titleCs}.`,
        link: '/dashboard.html#seminars',
      },
    });
    await sendMemberEmail(
      req.user,
      'Přihlášení na seminář ČAFR',
      `<p>Dobrý den ${escapeEmailHtml(req.user.firstName)},</p><p>Byli jste přihlášeni na seminář.</p><p><a href="${WEB_ORIGIN}/dashboard.html#seminars">Otevřít semináře</a></p>`,
      'SEMINAR_REGISTRATION'
    );

    res.status(201).json({ registration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/seminars/:id/register', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.seminarRegistration.findUnique({
      where: { seminarId_userId: { seminarId: req.params.id, userId: req.user.id } },
    });
    if (!existing) return res.status(404).json({ error: 'Registration not found' });
    await prisma.seminarRegistration.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/seminars', requireAdmin, async (_req, res) => {
  try {
    const seminars = await prisma.seminar.findMany({
      include: {
        registrations: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
      },
      orderBy: { startsAt: 'desc' },
    });
    res.json(seminars.map((item) => ({ ...seminarResponse(item), registrations: item.registrations })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/seminars', requireAdmin, async (req, res) => {
  try {
    const { titleCs, titleEn, descriptionCs, descriptionEn, location, startsAt, endsAt, capacity, status = 'DRAFT' } = req.body || {};
    if (!titleCs || !titleEn || !location || !startsAt || !endsAt) return res.status(400).json({ error: 'Required seminar fields are missing' });
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return res.status(400).json({ error: 'Invalid seminar dates' });
    const seminar = await prisma.seminar.create({
      data: {
        titleCs: String(titleCs).trim(),
        titleEn: String(titleEn).trim(),
        descriptionCs: descriptionCs ? String(descriptionCs).trim() : null,
        descriptionEn: descriptionEn ? String(descriptionEn).trim() : null,
        location: String(location).trim(),
        startsAt: start,
        endsAt: end,
        capacity: capacity ? Number(capacity) : null,
        status,
        createdById: req.user.id,
      },
    });
    res.status(201).json({ seminar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/seminars/:id', requireAdmin, async (req, res) => {
  try {
    const data = {};
    for (const key of ['titleCs','titleEn','descriptionCs','descriptionEn','location','status']) {
      if (req.body?.[key] !== undefined) data[key] = req.body[key] || null;
    }
    if (req.body?.startsAt !== undefined) data.startsAt = new Date(req.body.startsAt);
    if (req.body?.endsAt !== undefined) data.endsAt = new Date(req.body.endsAt);
    if (req.body?.capacity !== undefined) data.capacity = req.body.capacity ? Number(req.body.capacity) : null;
    const seminar = await prisma.seminar.update({ where: { id: req.params.id }, data });
    res.json({ seminar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/seminars/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.seminar.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/members/verify/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        membershipStatus: true,
        approvedAt: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ valid: false, status: 'NOT_FOUND' });
    }

    const cardNumber = `CAFR-${String(user.id).slice(-8).toUpperCase()}`;
    const valid = user.membershipStatus === 'APPROVED';

    return res.json({
      valid,
      status: user.membershipStatus,
      association: {
        name: process.env.ASSOCIATION_NAME || 'Česká asociace fotbalových rozhodčích, z. s.',
        ico: process.env.ASSOCIATION_ICO || 'bude doplněno',
        seat: process.env.ASSOCIATION_SEAT || 'bude doplněno',
      },
      checkedAt: new Date().toISOString(),
      member: {
        cardNumber,
        ...(valid && {
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          approvedAt: user.approvedAt,
        }),
      },
    });
  } catch (error) {
    console.error('Member verification error:', error);
    return res.status(500).json({ valid: false, status: 'ERROR' });
  }
});



app.post('/api/legal-requests', requireAuth, async (req, res) => {
  try {
    if (req.user.membershipStatus !== 'APPROVED') {
      return res.status(403).json({ error: 'Membership approval is required' });
    }
    const subject = String(req.body?.subject || '').trim();
    const category = String(req.body?.category || '').trim();
    const description = String(req.body?.description || '').trim();
    const urgency = String(req.body?.urgency || 'NORMAL');
    if (!subject || !category || !description) {
      return res.status(400).json({ error: 'Subject, category and description are required' });
    }
    if (!['NORMAL', 'HIGH', 'URGENT'].includes(urgency)) {
      return res.status(400).json({ error: 'Invalid urgency' });
    }
    const savedAttachments = await saveEvidenceAttachments(req.body?.attachments || [], 'legal');
    const legalRequest = await prisma.legalRequest.create({
      data: {
        userId: req.user.id,
        subject,
        category,
        description,
        urgency,
        attachments: savedAttachments.length ? { create: savedAttachments } : undefined,
      },
      include: { attachments: { orderBy: { createdAt: 'asc' } } },
    });
    await sendAdminEmail(
      'Nový právní dotaz ČAFR',
      `<p>Člen odeslal nový právní dotaz.</p><p><b>${escapeEmailHtml(req.user.firstName)} ${escapeEmailHtml(req.user.lastName)}</b><br>${escapeEmailHtml(req.user.email)}</p><p><b>${escapeEmailHtml(legalRequest.subject)}</b><br>${escapeEmailHtml(legalRequest.category)}</p><p><a href="${WEB_ORIGIN}/">Otevřít administraci</a></p>`,
      'ADMIN_NEW_LEGAL_REQUEST'
    );

    res.status(201).json({ legalRequest });
  } catch (error) {
    console.error('Create legal request error:', error);
    res.status(500).json({ error: 'Could not create legal request' });
  }
});

app.get('/api/legal-requests/me', requireAuth, async (req, res) => {
  try {
    const requests = await prisma.legalRequest.findMany({
      where: { userId: req.user.id },
      include: { attachments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('Member legal requests error:', error);
    res.status(500).json({ error: 'Could not load legal requests' });
  }
});

app.get('/api/admin/legal-requests', requireAdmin, async (_req, res) => {
  try {
    const requests = await prisma.legalRequest.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('Admin legal requests error:', error);
    res.status(500).json({ error: 'Could not load legal requests' });
  }
});

app.patch('/api/admin/legal-requests/:id', requireAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['NEW', 'IN_REVIEW', 'NEEDS_INFO', 'ANSWERED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid legal request status' });
    }
    const existing = await prisma.legalRequest.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (!existing) return res.status(404).json({ error: 'Legal request not found' });
    const adminReply = req.body?.adminReply !== undefined
      ? String(req.body.adminReply || '').trim() || null
      : existing.adminReply;
    const legalRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.legalRequest.update({
        where: { id: req.params.id },
        data: { status, adminReply },
      });
      if (existing.status !== status || existing.adminReply !== adminReply) {
        await tx.notification.create({
          data: {
            userId: updated.userId,
            type: 'LEGAL_REQUEST',
            title: 'Aktualizace právního dotazu',
            message: adminReply || `Stav právního dotazu byl změněn na ${status}.`,
            link: '/dashboard.html#legal',
          },
        });
      }
      return updated;
    });
    if (existing.status !== status || existing.adminReply !== adminReply) {
      await sendMemberEmail(
        existing.user,
        'Aktualizace právního dotazu ČAFR',
        `<p>Dobrý den ${escapeEmailHtml(existing.user.firstName)},</p><p>Váš právní dotaz byl aktualizován.</p><p><b>Stav:</b> ${escapeEmailHtml(status)}</p>${adminReply ? `<p><b>Odpověď ČAFR:</b><br>${escapeEmailHtml(adminReply)}</p>` : ''}<p><a href="${WEB_ORIGIN}/dashboard.html#legal">Otevřít právní podporu</a></p>`,
        'LEGAL_REQUEST_UPDATE'
      );
    }

    res.json({ legalRequest });
  } catch (error) {
    console.error('Update legal request error:', error);
    res.status(500).json({ error: 'Could not update legal request' });
  }
});


app.get('/api/fees/me', requireAuth, async (req, res) => {
  try {
    const fees = await prisma.membershipFee.findMany({
      where: { userId: req.user.id },
      orderBy: { year: 'desc' },
    });
    res.json(fees);
  } catch (error) {
    console.error('Member fees error:', error);
    res.status(500).json({ error: 'Could not load membership fees' });
  }
});

app.get('/api/admin/fees', requireAdmin, async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const fees = await prisma.membershipFee.findMany({
      where: Number.isInteger(year) ? { year } : undefined,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            membershipStatus: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { user: { lastName: 'asc' } }],
    });
    res.json(fees);
  } catch (error) {
    console.error('Admin fees error:', error);
    res.status(500).json({ error: 'Could not load membership fees' });
  }
});

app.post('/api/admin/fees/generate', requireAdmin, async (req, res) => {
  try {
    const year = Number(req.body?.year);
    const amountCzk = Number(req.body?.amountCzk);
    const dueDate = new Date(req.body?.dueDate);

    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    if (!Number.isInteger(amountCzk) || amountCzk < 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ error: 'Invalid due date' });
    }

    const members = await prisma.user.findMany({
      where: { membershipStatus: 'APPROVED', isActive: true },
      select: { id: true },
    });

    const result = await prisma.$transaction(
      members.map((member) =>
        prisma.membershipFee.upsert({
          where: { userId_year: { userId: member.id, year } },
          update: { amountCzk, dueDate },
          create: { userId: member.id, year, amountCzk, dueDate },
        })
      )
    );

    res.status(201).json({ createdOrUpdated: result.length });
  } catch (error) {
    console.error('Generate fees error:', error);
    res.status(500).json({ error: 'Could not generate membership fees' });
  }
});

app.patch('/api/admin/fees/:id', requireAdmin, async (req, res) => {
  try {
    const allowed = ['PENDING', 'PAID', 'OVERDUE', 'WAIVED'];
    const status = String(req.body?.status || '');
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid fee status' });

    const existing = await prisma.membershipFee.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (!existing) return res.status(404).json({ error: 'Membership fee not found' });

    const fee = await prisma.$transaction(async (tx) => {
      const updated = await tx.membershipFee.update({
        where: { id: req.params.id },
        data: {
          status,
          note: req.body?.note !== undefined ? String(req.body.note || '').trim() || null : undefined,
          paidAt: status === 'PAID' ? (existing.paidAt || new Date()) : null,
        },
      });

      if (existing.status !== status) {
        await tx.notification.create({
          data: {
            userId: updated.userId,
            type: 'MEMBERSHIP_FEE',
            title: 'Změna stavu členského příspěvku',
            message: `Členský příspěvek za rok ${updated.year} má nyní stav ${status}.`,
            link: '/dashboard.html#fees',
          },
        });
      }
      return updated;
    });

    if (existing.status !== status) {
      await sendMemberEmail(
        existing.user,
        'Změna stavu členského příspěvku ČAFR',
        `<p>Dobrý den ${escapeEmailHtml(existing.user.firstName)},</p><p>Stav vašeho členského příspěvku za rok ${escapeEmailHtml(fee.year)} byl změněn na <b>${escapeEmailHtml(fee.status)}</b>.</p><p><a href="${WEB_ORIGIN}/dashboard.html#fees">Otevřít členské příspěvky</a></p>`,
        'MEMBERSHIP_FEE_UPDATE'
      );
    }

    res.json({ fee });
  } catch (error) {
    console.error('Update fee error:', error);
    res.status(500).json({ error: 'Could not update membership fee' });
  }
});



const allowedDocumentMimes = new Map([
  ['application/pdf', '.pdf'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/msword', '.doc'],
]);

const allowedEvidenceMimes = new Map([
  ['application/pdf', '.pdf'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/msword', '.doc'],
  ['text/plain', '.txt'],
]);

function sanitizeFileName(name) {
  return String(name || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'document';
}

function decodeDataUrl(dataUrl) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function cloudUploadsEnabled() {
  return FILE_STORAGE === 'cloudinary';
}

function assertCloudinaryConfigured() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary storage is enabled, but CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET is missing.');
  }
}

async function uploadBufferToCloudinary({ buffer, mime, folder, originalName }) {
  assertCloudinaryConfigured();

  const cleanName = sanitizeFileName(originalName || 'upload');
  const baseName = sanitizeFileName(path.basename(cleanName, path.extname(cleanName)) || 'file');
  const publicId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${baseName}`;
  const targetFolder = [CLOUDINARY_FOLDER, folder].filter(Boolean).join('/');

  const form = new FormData();
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  form.append('folder', targetFolder);
  form.append('public_id', publicId);
  form.append('file', new Blob([buffer], { type: mime }), cleanName);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Cloud upload failed');
  }

  return {
    url: data.secure_url || data.url,
    publicId: data.public_id || null,
    sizeBytes: Number(data.bytes || buffer.length),
  };
}

async function saveUploadedFile({ decoded, originalName, subfolder, localBaseDir, publicPrefix }) {
  if (cloudUploadsEnabled()) {
    const uploaded = await uploadBufferToCloudinary({
      buffer: decoded.buffer,
      mime: decoded.mime,
      folder: subfolder,
      originalName,
    });

    return {
      url: uploaded.url,
      sizeBytes: uploaded.sizeBytes,
    };
  }

  await fs.mkdir(path.join(localBaseDir, subfolder || ''), { recursive: true });

  const extension = path.extname(originalName).toLowerCase();
  const baseName = sanitizeFileName(path.basename(originalName, extension) || 'file');
  const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${baseName}${extension}`;
  const localDir = path.join(localBaseDir, subfolder || '');
  const storedPath = path.join(localDir, storedName);
  await fs.writeFile(storedPath, decoded.buffer);

  return {
    url: `${publicPrefix}${subfolder ? `/${subfolder}` : ''}/${storedName}`,
    sizeBytes: decoded.buffer.length,
  };
}


async function saveEvidenceAttachments(files, folder) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  if (files.length > 5) {
    throw new Error('Maximum 5 attachments are allowed');
  }

  const maxBytes = 8 * 1024 * 1024;
  const saved = [];

  for (const file of files) {
    const decoded = decodeDataUrl(file?.fileData);
    const originalName = sanitizeFileName(file?.fileName || 'attachment');

    if (!decoded || !allowedEvidenceMimes.has(decoded.mime)) {
      throw new Error(`Unsupported attachment type: ${originalName}`);
    }

    if (decoded.buffer.length > maxBytes) {
      throw new Error(`Attachment is too large: ${originalName}`);
    }

    const extension = path.extname(originalName).toLowerCase() || allowedEvidenceMimes.get(decoded.mime);
    const normalizedName = `${sanitizeFileName(path.basename(originalName, path.extname(originalName)) || 'attachment')}${extension}`;
    const stored = await saveUploadedFile({
      decoded,
      originalName: normalizedName,
      subfolder: folder,
      localBaseDir: EVIDENCE_UPLOAD_DIR,
      publicPrefix: '/uploads/evidence',
    });

    saved.push({
      fileName: originalName,
      fileUrl: stored.url,
      mimeType: decoded.mime,
      sizeBytes: stored.sizeBytes,
    });
  }

  return saved;
}

function attachmentResponse(attachment) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt,
  };
}

function documentResponse(document) {
  return {
    id: document.id,
    titleCs: document.titleCs,
    titleEn: document.titleEn,
    descriptionCs: document.descriptionCs,
    descriptionEn: document.descriptionEn,
    category: document.category,
    url: document.url,
    visibility: document.visibility,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

app.get('/api/documents', requireAuth, async (req, res) => {
  try {
    const visibility = ['PUBLIC', 'MEMBERS'];
    if (req.user.membershipStatus === 'APPROVED') visibility.push('APPROVED_MEMBERS');
    if (['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(req.user.role)) visibility.push('ADMIN_ONLY');

    const documents = await prisma.document.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: { in: visibility },
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(documents.map(documentResponse));
  } catch (error) {
    console.error('Member documents error:', error);
    res.status(500).json({ error: 'Could not load documents' });
  }
});


app.post('/api/admin/documents/upload', requireAdmin, async (req, res) => {
  try {
    const {
      titleCs,
      titleEn,
      descriptionCs,
      descriptionEn,
      category = 'GENERAL',
      visibility = 'APPROVED_MEMBERS',
      status = 'PUBLISHED',
      fileName,
      fileData,
    } = req.body || {};

    const allowedVisibility = ['PUBLIC', 'MEMBERS', 'APPROVED_MEMBERS', 'ADMIN_ONLY'];
    const allowedStatus = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

    if (!titleCs || !titleEn || !fileName || !fileData) {
      return res.status(400).json({ error: 'titleCs, titleEn and file are required' });
    }

    if (!allowedVisibility.includes(String(visibility))) {
      return res.status(400).json({ error: 'Invalid document visibility' });
    }

    if (!allowedStatus.includes(String(status))) {
      return res.status(400).json({ error: 'Invalid document status' });
    }

    const decoded = decodeDataUrl(fileData);
    if (!decoded || !allowedDocumentMimes.has(decoded.mime)) {
      return res.status(400).json({ error: 'Unsupported document file type' });
    }

    const maxBytes = 8 * 1024 * 1024;
    if (decoded.buffer.length > maxBytes) {
      return res.status(413).json({ error: 'Document file is too large. Maximum is 8 MB.' });
    }

    const originalName = sanitizeFileName(fileName);
    const extension = path.extname(originalName).toLowerCase() || allowedDocumentMimes.get(decoded.mime);
    const normalizedName = `${sanitizeFileName(path.basename(originalName, path.extname(originalName)) || 'document')}${extension}`;
    const stored = await saveUploadedFile({
      decoded,
      originalName: normalizedName,
      subfolder: '',
      localBaseDir: DOCUMENT_UPLOAD_DIR,
      publicPrefix: '/uploads/documents',
    });

    const url = stored.url;

    const document = await prisma.document.create({
      data: {
        titleCs: String(titleCs).trim(),
        titleEn: String(titleEn).trim(),
        descriptionCs: descriptionCs ? String(descriptionCs).trim() : null,
        descriptionEn: descriptionEn ? String(descriptionEn).trim() : null,
        category: String(category || 'GENERAL').trim().toUpperCase(),
        url,
        visibility: String(visibility),
        status: String(status),
        createdById: req.user.id,
      },
    });

    res.status(201).json({ document: documentResponse(document), file: { url, size: stored.sizeBytes, mime: decoded.mime, storage: cloudUploadsEnabled() ? 'cloudinary' : 'local' } });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Could not upload document' });
  }
});

app.get('/api/admin/documents', requireAdmin, async (_req, res) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: { createdBy: true },
    });

    res.json(documents.map((document) => ({
      ...documentResponse(document),
      createdBy: document.createdBy ? publicUser(document.createdBy) : null,
    })));
  } catch (error) {
    console.error('Admin documents error:', error);
    res.status(500).json({ error: 'Could not load documents' });
  }
});

app.post('/api/admin/documents', requireAdmin, async (req, res) => {
  try {
    const {
      titleCs,
      titleEn,
      descriptionCs,
      descriptionEn,
      category = 'GENERAL',
      url,
      visibility = 'APPROVED_MEMBERS',
      status = 'PUBLISHED',
    } = req.body || {};

    const allowedVisibility = ['PUBLIC', 'MEMBERS', 'APPROVED_MEMBERS', 'ADMIN_ONLY'];
    const allowedStatus = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

    if (!titleCs || !titleEn || !url) {
      return res.status(400).json({ error: 'titleCs, titleEn and url are required' });
    }

    if (!allowedVisibility.includes(String(visibility))) {
      return res.status(400).json({ error: 'Invalid document visibility' });
    }

    if (!allowedStatus.includes(String(status))) {
      return res.status(400).json({ error: 'Invalid document status' });
    }

    const document = await prisma.document.create({
      data: {
        titleCs: String(titleCs).trim(),
        titleEn: String(titleEn).trim(),
        descriptionCs: descriptionCs ? String(descriptionCs).trim() : null,
        descriptionEn: descriptionEn ? String(descriptionEn).trim() : null,
        category: String(category || 'GENERAL').trim().toUpperCase(),
        url: String(url).trim(),
        visibility: String(visibility),
        status: String(status),
        createdById: req.user.id,
      },
    });

    res.status(201).json({ document: documentResponse(document) });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Could not create document' });
  }
});

app.patch('/api/admin/documents/:id', requireAdmin, async (req, res) => {
  try {
    const allowedVisibility = ['PUBLIC', 'MEMBERS', 'APPROVED_MEMBERS', 'ADMIN_ONLY'];
    const allowedStatus = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    const data = {};

    for (const field of ['titleCs', 'titleEn', 'descriptionCs', 'descriptionEn', 'category', 'url']) {
      if (req.body?.[field] !== undefined) {
        data[field] = req.body[field] ? String(req.body[field]).trim() : null;
      }
    }

    if (data.category) data.category = String(data.category).toUpperCase();

    if (req.body?.visibility !== undefined) {
      const visibility = String(req.body.visibility);
      if (!allowedVisibility.includes(visibility)) return res.status(400).json({ error: 'Invalid document visibility' });
      data.visibility = visibility;
    }

    if (req.body?.status !== undefined) {
      const status = String(req.body.status);
      if (!allowedStatus.includes(status)) return res.status(400).json({ error: 'Invalid document status' });
      data.status = status;
    }

    const document = await prisma.document.update({ where: { id: req.params.id }, data });
    res.json({ document: documentResponse(document) });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Could not update document' });
  }
});

app.delete('/api/admin/documents/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.document.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Archive document error:', error);
    res.status(500).json({ error: 'Could not archive document' });
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users.map(publicUser));
});

app.patch('/api/admin/users/:id/status', requireAdmin, async (req, res) => {
  const allowed = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
  const status = String(req.body?.membershipStatus || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid membership status' });
  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.params.id },
        data: { membershipStatus: status, approvedAt: status === 'APPROVED' ? new Date() : null },
      });

      await tx.notification.create({
        data: {
          userId: updated.id,
          type: 'MEMBERSHIP_STATUS',
          title: 'Změna stavu členství',
          message: `Stav vašeho členství byl změněn na ${status}.`,
          link: '/dashboard.html',
        },
      });

      return updated;
    });
    await sendMemberEmail(
      user,
      'Změna stavu členství ČAFR',
      `<p>Dobrý den ${escapeEmailHtml(user.firstName)},</p><p>Stav vašeho členství byl změněn na <b>${escapeEmailHtml(user.membershipStatus)}</b>.</p><p><a href="${WEB_ORIGIN}/dashboard.html">Otevřít členský dashboard</a></p>`,
      'MEMBERSHIP_STATUS'
    );

    res.json({ user: publicUser(user) });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const allowed = ['MEMBER', 'LECTURER', 'QUESTION_EDITOR', 'ADMIN', 'BOARD'];
  const role = String(req.body?.role || '');
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json({ user: publicUser(user) });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});


app.get('/api/admin/email-logs', requireAdmin, async (_req, res) => {
  const logs = await prisma.emailLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs);
});

app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
  const [questions, activeQuestions, attempts, aggregate] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: { isActive: true } }),
    prisma.attempt.count(),
    prisma.attempt.aggregate({ _avg: { score: true } }),
  ]);
  res.json({ questions, activeQuestions, attempts, averageScore: Math.round(aggregate._avg.score || 0) });
});


if (process.env.NODE_ENV === 'production') {
  app.use(express.static(DIST_DIR));

  app.get(/^\/(?!api\/).*/, async (req, res, next) => {
    try {
      const filePath = req.path === '/' ? '/index.html' : req.path;
      const absolutePath = path.join(DIST_DIR, filePath);
      await fs.access(absolutePath);
      return res.sendFile(absolutePath);
    } catch {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => console.log(`ČAFR API running on http://localhost:${PORT}`));
const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
