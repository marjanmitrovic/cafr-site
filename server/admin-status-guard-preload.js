import express from 'express';
import { prisma } from './lib/prisma.js';

const STATUS_ROUTE = '/api/admin/users/:id/status';
const ROLE_ROUTE = '/api/admin/users/:id/role';
const SUPER_ADMIN_EMAIL = String(process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'marjan.posao@gmail.com')
  .trim()
  .toLowerCase();
const originalPatch = express.application.patch;

// Repair/protect the primary owner account on every production start. This
// reverses an accidental suspension/demotion without changing the password.
// If the account exists, it is restored to an active approved ADMIN account.
try {
  const owner = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
  if (owner) {
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        role: 'ADMIN',
        membershipStatus: 'APPROVED',
        isActive: true,
        approvedAt: owner.approvedAt || new Date(),
      },
    });
    console.log(`[SUPER ADMIN] Protected account restored: ${SUPER_ADMIN_EMAIL}`);
  } else {
    console.warn(`[SUPER ADMIN] Account not found: ${SUPER_ADMIN_EMAIL}`);
  }
} catch (error) {
  console.error('[SUPER ADMIN] Could not restore protected account:', error);
}

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
        const actorEmail = String(req.user?.email || '').trim().toLowerCase();
        const requestedRole = String(req.body?.role || '').toUpperCase();

        // Only Marjan's protected account may grant ADMIN privileges.
        if (path === ROLE_ROUTE && requestedRole === 'ADMIN' && actorEmail !== SUPER_ADMIN_EMAIL) {
          return res.status(403).json({
            error: 'Pouze hlavní administrátor může přidělit roli ADMIN.',
            code: 'ADMIN_ROLE_OWNER_ONLY',
          });
        }

        const target = await prisma.user.findUnique({
          where: { id: req.params.id },
          select: { role: true, email: true },
        });

        const targetEmail = String(target?.email || '').trim().toLowerCase();

        // The protected owner account cannot be suspended or demoted by any
        // administrator, including by a direct API request.
        if (targetEmail === SUPER_ADMIN_EMAIL) {
          if (path === STATUS_ROUTE && String(req.body?.membershipStatus || '').toUpperCase() !== 'APPROVED') {
            return res.status(403).json({
              error: 'Stav hlavního administrátora nelze změnit.',
              code: 'SUPER_ADMIN_STATUS_PROTECTED',
            });
          }
          if (path === ROLE_ROUTE && requestedRole !== 'ADMIN') {
            return res.status(403).json({
              error: 'Roli hlavního administrátora nelze změnit.',
              code: 'SUPER_ADMIN_ROLE_PROTECTED',
            });
          }
        }

        // Existing administrators remain protected from accidental demotion
        // or membership-status changes.
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
