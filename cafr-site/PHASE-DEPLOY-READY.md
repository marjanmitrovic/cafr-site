# Phase: production deploy readiness

This package adds deployment readiness for a single Render web service.

## Added

- `npm run start` for production process managers.
- `npm run start:production` with `NODE_ENV=production`.
- `npm run render:build` for Prisma Client generation and Vite build.
- Express serves the Vite `dist/` folder in production.
- `render.yaml` blueprint for Render.
- `/api/test-email` remains available only outside production.

## Required deploy env vars

- `DATABASE_URL`
- `TOKEN_SECRET`
- `ADMIN_PASSWORD`
- `WEB_ORIGIN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_NOTIFY_EMAIL`
- `EMAIL_DISABLED=false`
- `NODE_ENV=production`

## After deploy

Run database push once from Render Shell or locally against production Neon:

```bash
npm run db:push
npm run db:seed
```

Then test:

- `/api/health`
- `/`
- `/dashboard.html`
- `/verify.html`
- admin login
- email sending
- member registration
