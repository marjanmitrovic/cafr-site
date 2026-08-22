import express from 'express';
import { prisma } from './lib/prisma.js';

const STATUS_ROUTE = '/api/admin/users/:id/status';
const ROLE_ROUTE = '/api/admin/users/:id/role';
const originalPatch = express.application.patch;

if (!express.application.__ucfrAdminStatusGuardInstalled) {
  Object.defineProperty(express.application, '__ucfrAdminStatusGuardInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  express.application.patch = function patchedPatch(path, ...handlers) {
    const protectedRoute = path === STATUS_ROUTE || path === ROLE_ROUTE;
    if (!protectedRoute || handlers.length === 0) {
      return originalPatch.call(this, path, ...handlers);
    }

    const protectAdminAccount = async (req, res, next) => {
      try {
        // Only the primary owner account (ADMIN_EMAIL on Render) may grant
        // ADMIN privileges. Other administrators can manage members and other
        // roles, but cannot create another administrator even by calling the
        // API directly.
        if (path === ROLE_ROUTE && String(req.body?.role || '').toUpperCase() === 'ADMIN') {
          const ownerEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
          const actorEmail = String(req.user?.email || '').trim().toLowerCase();

          if (!ownerEmail || actorEmail !== ownerEmail) {
            return res.status(403).json({
              error: 'Pouze hlavní administrátor může přidělit roli ADMIN.',
              code: 'ADMIN_ROLE_OWNER_ONLY',
            });
          }
        }

        const target = await prisma.user.findUnique({
          where: { id: req.params.id },
          select: { role: true },
        });

        if (target?.role === 'ADMIN') {
          const changingRole = path === ROLE_ROUTE;
          return res.status(403).json({
            error: changingRole
              ? 'Roli administrátora nelze měnit.'
              : 'Status administrátora nelze měnit.',
            code: changingRole
              ? 'ADMIN_ROLE_PROTECTED'
              : 'ADMIN_STATUS_PROTECTED',
          });
        }

        return next();
      } catch (error) {
        return next(error);
      }
    };

    const [authMiddleware, ...rest] = handlers;
    return originalPatch.call(this, path, authMiddleware, protectAdminAccount, ...rest);
  };
}
