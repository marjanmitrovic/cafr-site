# ČAFR Phase 4 — Neon PostgreSQL

## Prvo pokretanje

```bash
cp .env.example .env
nano .env
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:3001/api/health
- Prisma Studio: `npm run db:studio`

`db:seed` prenosi demonstraciona pitanja iz `server/data/questions.json` u Neon, kreira kategorije, testove i administratorski nalog. Može se bezbedno pokrenuti ponovo.

Posle provere Neon baze JSON datoteke ostaju samo kao seed izvor i više se ne koriste u radu API-ja.
