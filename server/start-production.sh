#!/bin/sh
set -eu

# Emergency-safe Render bootstrap: always ensure runtime dependencies are
# present before Node loads any preload module. This avoids ERR_MODULE_NOT_FOUND
# when Render starts an instance with an incomplete node_modules directory.
echo "[BOOT] Ensuring Node runtime dependencies are installed..."
npm install --include=dev --no-audit --no-fund

echo "[BOOT] Generating Prisma client..."
npm run db:generate

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
