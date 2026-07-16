# ČAFR web – Phase 2

Public bilingual website plus a local API for the education/test module.

## Run on Linux

```bash
cd cafr-site-phase2
rm -rf node_modules package-lock.json
npm install
npm run dev
```

Web: http://localhost:5173  
API health: http://localhost:3001/api/health

## API included

- public randomized questions without correct answers
- server-side grading and attempt storage
- result history by user id
- administrator login
- add, edit and deactivate questions
- statistics endpoint

Data is stored locally in `server/data/*.json`. This is suitable for development and a pilot. PostgreSQL should replace it before public launch.

## Administrator

Development defaults only:

- email: `admin@cafr.local`
- password: `CAFR-change-me-2026`

Set secure values from `.env.example` before deployment. Node does not automatically load `.env`; export variables in the shell or use your deployment platform's environment settings.


## Fáze 3 – propojené testy a administrace

- Frontend načítá otázky z API.
- Server vyhodnocuje odpovědi a ukládá výsledky.
- Procvičování kontroluje každou odpověď přes API.
- „Moje výsledky“ se načítají ze serveru.
- V sekci Vzdělávání je administrace testů.
- Přihlášení správce: `admin@cafr.local` / `CAFR-change-me-2026` (pouze vývoj).
- Před nasazením zkopírujte `.env.example` na `.env` a změňte heslo a tajný klíč.


## Email system

See `PHASE-EMAILS.md`. Email sending uses Resend HTTP API and requires `RESEND_API_KEY` in `.env`.


## Resend SDK email test

Install dependencies, put your real Resend key in `.env` by replacing `re_xxxxxxxxx`, then run:

```bash
curl http://localhost:3001/api/test-email
```

For the first test, `EMAIL_FROM="ČAFR <onboarding@resend.dev>"` can be used. After domain verification, use `no-reply@cafr.cz`.

## Cloud storage for uploads

For production, set:

```env
FILE_STORAGE="cloudinary"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_UPLOAD_PRESET="your_unsigned_upload_preset"
CLOUDINARY_FOLDER="cafr"
```

For local development, keep:

```env
FILE_STORAGE="local"
```

See `PHASE-CLOUD-STORAGE.md`.


## IČO / údaje spolku

Projekt obsahuje placeholder pro IČO:

```text
IČO: bude doplněno
```

Po registraci spolku doplňte skutečné údaje v `.env`:

```env
ASSOCIATION_NAME="Česká asociace fotbalových rozhodčích, z. s."
ASSOCIATION_ICO="12345678"
ASSOCIATION_SEAT="..."
```
