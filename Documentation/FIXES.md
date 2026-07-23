# UČFR – ispravljena verzija

Ispravljeno:

- `prisma/seed.js` koristi ESM-kompatibilan default import iz `@prisma/client`.
- `server/lib/prisma.js` koristi isti ESM-kompatibilan import.
- Nema više importa iz `generated/prisma/client.js`.
- Prisma generator ostaje `prisma-client-js`.
- Seed koristi `bcryptjs`, Neon PostgreSQL adapter i postojeći `server/data/questions.json`.

Pokretanje:

```bash
cp .env.example .env
# unesite DATABASE_URL, TOKEN_SECRET, ADMIN_EMAIL i ADMIN_PASSWORD
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```
