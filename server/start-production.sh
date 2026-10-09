#!/bin/sh
set -eu

echo "[BOOT] Verifying dependencies prepared during build..."
node -e "require.resolve('express/package.json'); require.resolve('@prisma/client/package.json'); require.resolve('@prisma/adapter-pg/package.json'); require.resolve('pg/package.json')"

echo "[BOOT] Starting UČFR API..."
exec node \
  --import ./server/admin-status-guard-preload.js \
  --import ./server/rejected-user-delete-preload.js \
  --import ./server/facr-registration-guard-preload.js \
  --import ./server/question-bank-preload.js \
  --import ./server/ucfr-details-preload.js \
  --import ./server/brevo-password-reset-preload.js \
  --import ./server/public-member-count-preload.js \
  --import ./server/admin-users-pagination-preload.js \
  --import ./server/local-units-preload.js \
  --import ./server/news-content-migration-preload.js \
  --import ./server/news-preload.js \
  server/server.js
