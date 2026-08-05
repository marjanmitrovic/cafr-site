# UČFR — Cloudflare Pages setup

## Git project

- Repository: `marjanmitrovic/cafr-site`
- Production branch: `main`
- Framework preset: `Vite`
- Root directory: repository root
- Build command: `npm install --no-audit --no-fund && npm run build`
- Build output directory: `dist`

## Environment variables

Set these for Production and Preview:

```text
NODE_VERSION=22
UCFR_BACKEND_ORIGIN=https://ucfr.onrender.com
```

`UCFR_BACKEND_ORIGIN` is read by Pages Functions at runtime. The browser continues to call same-origin paths such as `/api/auth/login`; Cloudflare proxies only `/api/*` and `/uploads/*` to Render.

## First-deploy checks

Before moving `ucfr.cz`, verify on the generated `*.pages.dev` URL:

1. Public homepage and images load.
2. `/api/health` returns JSON from Render.
3. Member login works.
4. Administration opens.
5. Password-reset request returns a controlled response.
6. `/uploads/*` files, if present, are reachable.

## Domain cutover

Do not attach the apex domain until the `pages.dev` deployment passes the checks above. Keep the existing Render custom domain active during testing. After Cloudflare Pages is verified:

1. Add `ucfr.cz` to Cloudflare Pages.
2. Preserve all MX, SPF, DKIM and DMARC records used by Endora mail.
3. Point the domain to Cloudflare only after DNS records have been checked.
4. Remove `ucfr.cz` from the Render service after Pages is active.
5. Keep Render available through `https://ucfr.onrender.com` as the private backend origin.

## Cost control

Static requests do not invoke Functions because `public/_routes.json` includes only `/api/*` and `/uploads/*`. This keeps ordinary page, CSS, JavaScript and image traffic on static Pages delivery.
