# UCFR Cloudflare backend feasibility lab

The Git-connected `cafr-site` Worker serves the Vite site and the combined Express backend on its preview hostname. Its custom build generates Prisma and bundles both using a local placeholder URL. Runtime credentials are configured separately from builds.

## Setup
Use Node.js 22. In this directory run npm install, npm test, and npm run check. Review the generated lockfile before any production migration.
Authenticate to the existing Cloudflare account with npx wrangler login. Check the account is on Workers Free.
The Worker name is `cafr-site`. Its Workers Builds project uses `experiments/cloudflare-backend` as the root. Keep its existing Git integration on the PR branch and its public hostname separate from `ucfr.cz` and `www.ucfr.cz`.
Set LAB_TOKEN with npx wrangler secret put LAB_TOKEN (random secret, at least 32 characters).
Set LAB_DATABASE_URL with npx wrangler secret put LAB_DATABASE_URL, using only a non-production Neon branch and a restricted read-only DB role. Never paste credentials into GitHub or chat.

## Acceptance
GET /health: 200 without database calls. The `version` field identifies the active Cloudflare Worker version and can be compared with the Workers Builds GitHub check.
From this directory, run `node staging-smoke.mjs "$WORKER_URL" "$VERSION_ID"` with the public staging URL and the version ID from that check. It verifies static delivery, diagnostics and access control using anonymous requests.
POST /diagnostics/database: Bearer LAB_TOKEN required. SELECT 1 and check the User table exists; no member rows, no writes, no migrations.
POST /diagnostics/bcrypt: Bearer LAB_TOKEN required. Runs a synthetic bcrypt hash at cost 12, which is used by the existing production registration and password change flow. Measure CPU in Cloudflare Observability (not only wall time). If the free-tier invocation hits CPU limits, this is a failed feasibility test; do not reduce password security. No member credentials are used.
The public home page uses the static assets binding. Open [/preview](https://cafr-site.panblesku.workers.dev/preview) to see which runtime settings need attention and to open a fifteen-minute preview in a browser. The four settings and the acceptance checks are in [the deployment guide](../../cloudflare/README.md). Member authentication and file permissions still apply after preview access. Preview mail links point back to this hostname. Adding any of the four runtime settings closes the old lab diagnostics and its synthetic login pilot. The public version check stays available.

## Before any production cutover
The existing Express backend has Prisma/PostgreSQL, authentication/authorization, emails, file uploads and preload scripts that modify routing and database behavior. Port and regression-test these separately. Use a compatible DB adapter or explicit SQL with parameter binding. Confirm secure handling of existing bcrypt hashes, JWT/session compatibility, roles, registration/password resets, data writes, uploads and all admin/member features. Do not weaken hashing or reset member passwords merely to fit the free CPU limit. Test CPU and bundle size limits, Neon quotas, privacy and rollback. Local file storage must be replaced or handled separately. Retain Render and the current domain routing until end-to-end tests pass. No migration is authorized by this lab alone.

## Authentication pilot
The isolated Worker exposes POST /lab/api/auth/login and GET /lab/api/auth/me, both protected by X-UCFR-Lab-Token. The login accepts only the synthetic email ucfr-lab@example.invalid and fixture password. SQL constructs a synthetic row without selecting any member data or modifying Neon. A cost-12 bcrypt comparison and separate ten-minute HS256 session are exercised. The browser diagnostic page runs both requests without showing the JWT. Neither the pilot nor its session tokens can be used for production authentication. See the [candidate](candidate/README.md) for Express API configuration and the [combined Worker](../../cloudflare/README.md) for production acceptance and rollback.
