import { normalizeFacrId } from './facr-public.js';
import { prisma } from './prisma.js';

export function registrationFacrId(status) {
  const match = String(status || '').match(/ID\s*FAČR\s*:\s*([0-9]+)/i);
  return match ? normalizeFacrId(match[1]) : '';
}

export async function createRegisteredUser(data) {
  const id = registrationFacrId(data.refereeStatus);
  if (!id) return prisma.user.create({ data });
  return prisma.$transaction(async tx => {
    // Separate isolates and the Render rollback instance share the same lock
    // when running this revision. Existing memberships do not need rewriting.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 24417513))::text AS lock`;
    const candidates = await tx.user.findMany({
      where: { refereeStatus: { not: null } }, select: { refereeStatus: true },
    });
    if (candidates.some(member => registrationFacrId(member.refereeStatus) === id)) return null;
    return tx.user.create({ data });
  });
}
