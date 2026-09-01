#!/bin/sh
set -eu

echo "[BOOT] Installing runtime dependencies..."
npm install --omit=dev --no-audit --no-fund

if ! node -e "require.resolve('express/package.json'); require.resolve('@prisma/client/package.json'); require.resolve('@prisma/adapter-pg/package.json'); require.resolve('pg/package.json')" >/dev/null 2>&1; then
  echo "[BOOT] Core runtime packages still missing; installing explicitly..."
  npm install --no-save --omit=dev --no-audit --no-fund express@^5.1.0 @prisma/client@^7.8.0 @prisma/adapter-pg@^7.8.0 pg@^8.16.3 bcryptjs@^3.0.2 cors@^2.8.5 jsonwebtoken@^9.0.2 resend@^6.0.0
fi

echo "[BOOT] Verifying Express..."
node -e "console.log('[BOOT] express:', require.resolve('express/package.json'))"

echo "[BOOT] Generating Prisma client..."
npx prisma generate --config ./prisma.config.ts

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
