# UČFR Worker deployment

The Git-connected `cafr-site` Worker runs the Vite site and the combined Express API on its staging hostname. The standalone `cloudflare/wrangler.jsonc` builds the same application as `ucfr-site-next` for eventual promotion. The repository-root configuration deploys the current Render proxy.

For the existing staging Worker, open [the preview page](https://cafr-site.panblesku.workers.dev/preview). It lists only missing or invalid runtime setting names. In Workers & Pages, select `cafr-site`, open Settings → Variables and Secrets and add each value with type Secret. Use Deploy to publish the bindings. A controlled browser test can open the site at `/preview` after entering the separate preview key. The grant lasts fifteen minutes and member and administrator routes still require the normal member credentials.

Use the repository root as the build directory. The build command is below. The build-time PostgreSQL URL is a local placeholder used by Prisma to generate the client.

```sh
npm ci --include=dev --no-audit --no-fund && DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate && npm run build && npm ci --prefix experiments/cloudflare-backend --no-audit --no-fund && node experiments/cloudflare-backend/candidate/prepare.mjs
```

Deploy the separate Worker with `experiments/cloudflare-backend/node_modules/.bin/wrangler deploy --config cloudflare/wrangler.jsonc`. Append `--dry-run` to check the bundle locally. Configure runtime secrets on the Worker itself.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | TLS connection to the intended Neon database. The runtime verifies the server certificate. |
| `TOKEN_SECRET` | Existing production signing secret, at least 32 characters, to preserve member sessions. Use a separate value with a synthetic staging database. |
| `BREVO_API_KEY` | Transactional mail for password resets and membership notifications. Configure a verified sender with `BREVO_SENDER_EMAIL` and `BREVO_SENDER_NAME` when overriding the default `info@ucfr.cz`. |
| `UCFR_PREVIEW_TOKEN` | Independent random secret of 32–256 characters. The setup page can generate it locally. API clients may use `X-UCFR-Preview-Token`. Browsers receive a short-lived, host-only HttpOnly cookie after opening the preview. |

Apply `experiments/cloudflare-backend/candidate/storage.sql` and `password.sql`, plus `cloudflare/reset-window.sql`, to the selected Neon database before running API tests. No schema push or seed runs when the Worker starts. Registration authorizes membership through the original routes. Password checks use PostgreSQL bcrypt and a transaction-local key to keep the password out of SQL bind values. Uploaded bytes and their owning record share one transaction. Existing provider-hosted links retain their original URLs.

## Cutover and rollback

On the separate Worker, check existing-session and fresh login, member and admin permissions, private upload/download with exact byte comparison, and actual Brevo delivery to a controlled test mailbox. Measure CPU and requests in Workers Analytics for the same test window, including first requests to a cold Worker and representative uploads. An HTTP 200 from a mail route does not confirm inbox delivery. Verify access to existing attachments before retiring Render.

Preserve the current Worker deployment and custom-domain assignments for rollback. After the staged checks, switch the existing web hostnames and repeat the tests on both `ucfr.cz` and `www.ucfr.cz`. Verify `/api/edge-health` reports `backend: cloudflare-worker` and the actual API response carries `X-UCFR-Backend: cloudflare-worker`. Disable the old Worker’s scheduled Render probe and suspend the Render web service only after successful production checks. Restore the original domain assignment and resume Render if rollback is needed. Neither path requires changing the domain’s mail records.
