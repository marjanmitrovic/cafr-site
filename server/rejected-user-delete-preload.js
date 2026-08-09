import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma.js';

const originalListen = express.application.listen;
const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';

async function requireAdmin(req, res) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = jwt.verify(token, TOKEN_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive || !['ADMIN', 'BOARD', 'QUESTION_EDITOR'].includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return null;
    }

    return user;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

if (!express.application.__ucfrRejectedDeleteInstalled) {
  express.application.__ucfrRejectedDeleteInstalled = true;

  express.application.listen = function ucfrListenWithRejectedDelete(...args) {
    if (!this.__ucfrRejectedDeleteRouteRegistered) {
      this.__ucfrRejectedDeleteRouteRegistered = true;

      this.delete('/api/admin/users/:id', async (req, res) => {
        const actor = await requireAdmin(req, res);
        if (!actor) return;

        try {
          const target = await prisma.user.findUnique({
            where: { id: String(req.params.id) },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              membershipStatus: true,
            },
          });

          if (!target) return res.status(404).json({ error: 'User not found' });
          if (target.id === actor.id) return res.status(403).json({ error: 'You cannot delete your own account' });
          if (target.role === 'ADMIN') return res.status(403).json({ error: 'Administrator accounts cannot be deleted here' });
          if (target.membershipStatus !== 'REJECTED') {
            return res.status(409).json({ error: 'Only rejected registrations can be deleted' });
          }

          await prisma.$transaction(async (tx) => {
            // EmailLog is intentionally not modeled as a Prisma relation to User,
            // so remove rows carrying this user's identifier explicitly.
            await tx.emailLog.deleteMany({ where: { userId: target.id } });
            await tx.user.delete({ where: { id: target.id } });
          });

          console.log(`[ADMIN] Rejected registration deleted: ${target.email} (${target.id}) by ${actor.email}`);
          return res.json({
            ok: true,
            deletedUser: {
              id: target.id,
              firstName: target.firstName,
              lastName: target.lastName,
              email: target.email,
            },
          });
        } catch (error) {
          console.error('Delete rejected registration error:', error);
          return res.status(500).json({ error: 'Could not delete rejected registration' });
        }
      });
    }

    return originalListen.apply(this, args);
  };
}
