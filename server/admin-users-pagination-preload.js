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
          const page = positiveInt(request.query.page, 1);
          const limit = Math.min(100, positiveInt(request.query.limit, 50));
          const query = String(request.query.q || '').trim().slice(0, 120);
          const exportAll = String(request.query.export || '') === '1';
          const idQuery = query.replace(/^UCFR-/i, '').trim();

          const where = query
            ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query, mode: 'insensitive' } },
                  { region: { contains: query, mode: 'insensitive' } },
                  { refereeStatus: { contains: query, mode: 'insensitive' } },
                  ...(idQuery ? [{ id: { contains: idQuery, mode: 'insensitive' } }] : []),
                ],
              }
            : {};

          if (exportAll) {
            const users = await prisma.user.findMany({
              where,
              orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'desc' }],
            });
            response.set('Cache-Control', 'no-store');
            return response.json({ users: users.map(publicUser), total: users.length });
          }

          const skip = (page - 1) * limit;
          const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
              where,
              orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'desc' }],
              skip,
              take: limit,
            }),
            prisma.user.count({ where }),
          ]);

          const totalPages = Math.max(1, Math.ceil(total / limit));
          const safePage = Math.min(page, totalPages);

          if (safePage !== page && total > 0) {
            const correctedUsers = await prisma.user.findMany({
              where,
              orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'desc' }],
              skip: (safePage - 1) * limit,
              take: limit,
            });

            response.set('Cache-Control', 'no-store');
            return response.json({
              users: correctedUsers.map(publicUser),
              page: safePage,
              limit,
              total,
              totalPages,
            });
          }

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
