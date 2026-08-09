#!/bin/sh
set -eu

# Render services created/edited manually can occasionally start with an empty
# or incomplete node_modules directory (for example after a cache/runtime
# change). Do not let the API fail with ERR_MODULE_NOT_FOUND in that case.
if ! node -e "require.resolve('express/package.json'); require.resolve('@prisma/client/package.json')" >/dev/null 2>&1; then
  echo "[BOOT] Node dependencies are missing or incomplete. Installing dependencies..."
  npm install --include=dev --no-audit --no-fund
  echo "[BOOT] Generating Prisma client..."
  npm run db:generate
fi

exec node \
  --import ./server/admin-status-guard-preload.js \
  --import ./server/rejected-user-delete-preload.js \
  --import ./server/facr-registration-guard-preload.js \
  --import ./server/question-bank-preload.js \
  --import ./server/ucfr-details-preload.js \
  --import ./server/brevo-password-reset-preload.js \
  --import ./server/public-member-count-preload.js \
  --import ./server/news-content-migration-preload.js \
  --import ./server/news-preload.js \
  server/server.js
