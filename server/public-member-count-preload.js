import express from 'express';
import { prisma } from './lib/prisma.js';

const originalListen = express.application.listen;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedCount = null;
let cachedAt = 0;
let countInFlight = null;

async function getApprovedMemberCount() {
  const now = Date.now();
  if (Number.isFinite(cachedCount) && now - cachedAt < CACHE_TTL_MS) {
    return cachedCount;
  }

  if (countInFlight) return countInFlight;

  countInFlight = prisma.user.count({
    where: {
      membershipStatus: 'APPROVED',
    },
  }).then((count) => {
    cachedCount = count;
    cachedAt = Date.now();
    return count;
  }).finally(() => {
    countInFlight = null;
  });

  return countInFlight;
}

if (!express.application.__ucfrPublicMemberCountInstalled) {
  express.application.__ucfrPublicMemberCountInstalled = true;

  express.application.listen = function ucfrListenWithPublicMemberCount(...args) {
    if (!this.__ucfrPublicMemberCountRouteRegistered) {
      this.__ucfrPublicMemberCountRouteRegistered = true;

      this.get('/api/public/member-count', async (_req, res) => {
        try {
          const count = await getApprovedMemberCount();

          res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
          return res.json({ count, status: 'APPROVED' });
        } catch (error) {
          console.error('Public member count error:', error);
          return res.status(503).json({ error: 'Member count is temporarily unavailable' });
        }
      });
    }

    return originalListen.apply(this, args);
  };
}
