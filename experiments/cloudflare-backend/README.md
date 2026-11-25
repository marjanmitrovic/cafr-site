# UCFR Cloudflare backend feasibility lab

This is an isolated experiment, not a replacement for production. It does not use the production Worker, domains, Render proxy, cron, Prisma migrations, or actual member login.

## Setup
Use Node.js 22. In this directory run npm install, npm test, and npm run check. Review the generated lockfile before any production migration.
Authenticate to the existing Cloudflare account with npx wrangler login. Check the account is on Workers Free.
Deploy this directory only (npm run deploy). The worker name is ucfr-api-lab; do not attach ucfr.cz or www.ucfr.cz.
Set LAB_TOKEN with npx wrangler secret put LAB_TOKEN (random secret, at least 32 characters).
Set LAB_DATABASE_URL with npx wrangler secret put LAB_DATABASE_URL, using only a non-production Neon branch and a restricted read-only DB role. Never paste credentials into GitHub or chat.

## Acceptance
GET /health: 200 without database calls.
POST /diagnostics/database: Bearer LAB_TOKEN required. SELECT 1 and check the User table exists; no member rows, no writes, no migrations.
POST /diagnostics/bcrypt: Bearer LAB_TOKEN required. Runs a synthetic bcrypt hash at cost 12, which is used by the existing production registration and password change flow. Measure CPU in Cloudflare Observability (not only wall time). If the free-tier invocation hits CPU limits, this is a failed feasibility test; do not reduce password security. No member credentials are used.
Unknown paths, including /api/auth/login, return 404. Missing/incorrect token returns 401.

## Before any production cutover
The existing Express backend has Prisma/PostgreSQL, authentication/authorization, emails, file uploads and preload scripts that modify routing and database behavior. Port and regression-test these separately. Use a compatible DB adapter or explicit SQL with parameter binding. Confirm secure handling of existing bcrypt hashes, JWT/session compatibility, roles, registration/password resets, data writes, uploads and all admin/member features. Do not weaken hashing or reset member passwords merely to fit the free CPU limit. Test CPU and bundle size limits, Neon quotas, privacy and rollback. Local file storage must be replaced or handled separately. Retain Render and the current domain routing until end-to-end tests pass. No migration is authorized by this lab alone.
