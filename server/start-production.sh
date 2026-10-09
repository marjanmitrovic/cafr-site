#!/bin/sh
set -eu

# This script is used exclusively for the production Render web service.
# The actual Render service may not have imported render.yaml environment variables.
export NODE_ENV=production
echo "[BOOT] NODE_ENV=$NODE_ENV PORT=${PORT:-unset} API_PORT=${API_PORT:-unset}"

echo "[BOOT] Verifying dependencies prepared during build..."
node -e "import('express').then(() => import('@prisma/client')).then(() => import('@prisma/adapter-pg')).then(() => import('pg')).catch(err => { console.error(err); process.exit(1); })"

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
