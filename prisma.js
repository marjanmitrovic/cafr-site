import { PrismaPg } from '@prisma/adapter-pg';
import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Add the Neon connection string to .env.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
