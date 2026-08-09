import express from 'express';
import { prisma } from './lib/prisma.js';

const STATUS_ROUTE = '/api/admin/users/:id/status';
const originalPatch = express.application.patch;

if (!express.application.__ucfrAdminStatusGuardInstalled) {
  Object.defineProperty(express.application, '__ucfrAdminStatusGuardInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  express.application.patch = function patchedPatch(path, ...handlers) {
    if (path !== STATUS_ROUTE || handlers.length === 0) {
      return originalPatch.call(this, path, ...handlers);
    }

    const protectAdminStatus = async (req, res, next) => {
      try {
        const target = await prisma.user.findUnique({
          where: { id: req.params.id },
          select: { role: true },
        });

        if (target?.role === 'ADMIN') {
          return res.status(403).json({
            error: 'Status administrátora nelze měnit.',
            code: 'ADMIN_STATUS_PROTECTED',
          });
        }

        return next();
      } catch (error) {
        return next(error);
      }
    };

    const [authMiddleware, ...rest] = handlers;
    return originalPatch.call(this, path, authMiddleware, protectAdminStatus, ...rest);
  };
}
