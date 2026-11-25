# Express migration candidate

Uses the actual Express server and nine existing route preloads generated from the repository. The main branch, production Worker, Render and database are unchanged.

Build from repository root:
1. npm ci
2. DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate
3. npm ci --prefix experiments/cloudflare-backend
4. node experiments/cloudflare-backend/candidate/prepare.mjs
5. cd experiments/cloudflare-backend
6. npx wrangler deploy --config candidate/wrangler.jsonc --dry-run

No deployment is performed by these commands. The candidate must have its own Worker name, isolated staging database and three independent configuration values: CANDIDATE_DATABASE_URL (secret), CANDIDATE_DATABASE_HOST (the exact staging endpoint hostname), CANDIDATE_SESSION_SECRET (random secret, at least 32 chars), and CANDIDATE_ACCESS_TOKEN (different random secret). Do not reuse LAB_DATABASE_URL or production credentials. Use a restricted read-only role and a synthetic-only database. Never attach ucfr.cz. Access protected by X-UCFR-Candidate-Token, separate from member Authorization bearer token. Only reads and login are permitted; all writes return 405. Startup data changes, outbound emails and local uploads are disabled. The actual production source is not modified.

Outstanding gates: real workerd import and HTTP bridge test, per-request Prisma connectivity and transaction behavior, password CPU limits, safe staging data, authorization/role parity, distributed FAČR uniqueness, email delivery, durable storage and existing attachment migration, all mutation routes, load tests and rollback. The candidate is not production-ready. Do not merge or switch DNS based only on a successful build.
