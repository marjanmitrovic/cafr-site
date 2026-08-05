import express from 'express';
import { prisma } from './lib/prisma.js';

const originalListen = express.application.listen;

if (!express.application.__ucfrPublicMemberCountInstalled) {
  express.application.__ucfrPublicMemberCountInstalled = true;

  express.application.listen = function ucfrListenWithPublicMemberCount(...args) {
    if (!this.__ucfrPublicMemberCountRouteRegistered) {
      this.__ucfrPublicMemberCountRouteRegistered = true;

      this.get('/api/public/member-count', async (_req, res) => {
        try {
          const count = await prisma.user.count({
            where: {
              membershipStatus: 'APPROVED',
              isActive: true,
            },
          });

          res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
          return res.json({ count });
        } catch (error) {
          console.error('Public member count error:', error);
          return res.status(503).json({ error: 'Member count is temporarily unavailable' });
        }
      });
    }

    return originalListen.apply(this, args);
  };
}
