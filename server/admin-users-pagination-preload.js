import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma.js';

const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';
const originalListen = express.application.listen;

const publicUser = (user) => ({
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

async function requireAdmin(request, response) {
  try {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(user.role)) {
      response.status(403).json({ error: 'Forbidden' });
      return null;
    }
    return user;
  } catch {
    response.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

if (!express.application.__ucfrAdminUsersPaginationInstalled) {
  express.application.__ucfrAdminUsersPaginationInstalled = true;

  express.application.listen = function ucfrListenWithAdminUsersPagination(...args) {
    if (!this.__ucfrAdminUsersPaginationRouteRegistered) {
      this.__ucfrAdminUsersPaginationRouteRegistered = true;

      this.get('/api/admin/users-page', async (request, response) => {
        const admin = await requireAdmin(request, response);
        if (!admin) return;

        try {
          if (String(request.query.summary || '') === '1') {
            const [total, pending, approved, rejected, suspended] = await Promise.all([
              prisma.user.count(),
              prisma.user.count({ where: { membershipStatus: 'PENDING' } }),
              prisma.user.count({ where: { membershipStatus: 'APPROVED' } }),
              prisma.user.count({ where: { membershipStatus: 'REJECTED' } }),
              prisma.user.count({ where: { membershipStatus: 'SUSPENDED' } }),
            ]);
            response.set('Cache-Control', 'no-store');
            return response.json({ total, pending, approved, rejected, suspended });
          }

          const page = positiveInt(request.query.page, 1);
          const limit = Math.min(100, positiveInt(request.query.limit, 50));
          const query = String(request.query.q || '').trim().slice(0, 120);
          const region = String(request.query.region || '').trim().slice(0, 120);
          const status = String(request.query.status || '').trim().toUpperCase();
          const exportAll = String(request.query.export || '') === '1';
          const idQuery = query.replace(/^UCFR-/i, '').trim();

          const clauses = [];
          if (query) {
            clauses.push({
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
                { region: { contains: query, mode: 'insensitive' } },
                { refereeStatus: { contains: query, mode: 'insensitive' } },
                ...(idQuery ? [{ id: { contains: idQuery, mode: 'insensitive' } }] : []),
              ],
            });
          }
          if (region && region !== 'ALL') clauses.push({ region });
          if (['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) clauses.push({ membershipStatus: status });
          const where = clauses.length ? { AND: clauses } : {};

          if (exportAll) {
            const users = await prisma.user.findMany({
              where,
              orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'desc' }],
            });
            response.set('Cache-Control', 'no-store');
            return response.json({ users: users.map(publicUser), total: users.length });
          }

          const total = await prisma.user.count({ where });
          const totalPages = Math.max(1, Math.ceil(total / limit));
          const safePage = Math.min(page, totalPages);
          const users = await prisma.user.findMany({
            where,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'desc' }],
            skip: (safePage - 1) * limit,
            take: limit,
          });

          response.set('Cache-Control', 'no-store');
          return response.json({
            users: users.map(publicUser),
            page: safePage,
            limit,
            total,
            totalPages,
          });
        } catch (error) {
          console.error('Admin users pagination error:', error);
          return response.status(500).json({ error: 'Could not load members' });
        }
      });
    }

    return originalListen.apply(this, args);
  };
}
