# UČFR – kompletna verzija

Sadrži:
- CZ/EN sa zastavicama
- prevedenu News/Aktuality sekciju
- Neon PostgreSQL + Prisma 7
- registraciju članova sa statusom PENDING
- login članova i administratora
- profile API (`/api/auth/me`)
- administrativne rute za članove, statuse i uloge
- testove, rezultate i administraciju pitanja
- PDF radnog nacrta statuta

## Pokretanje

```bash
cp .env.example .env
# upišite Neon DATABASE_URL, TOKEN_SECRET i administratorsku lozinku
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Sajt: http://localhost:5173
API: http://localhost:3001/api/health

Administrator je vrednost `ADMIN_EMAIL` iz `.env` (podrazumevano `admin@cafr.cz`).

## Phase: Document uploads

Admin panel now supports direct document upload. Files are stored locally in `public/uploads/documents` and published through `/uploads/documents/...` URLs. Existing external/internal URL document links still work. Maximum upload size is 8 MB.


## Email system

See `PHASE-EMAILS.md`. Email sending uses Resend HTTP API and requires `RESEND_API_KEY` in `.env`.
