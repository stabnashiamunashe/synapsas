#!/usr/bin/env bash
# One-shot pull + build + (re)start for an Ubuntu server.
#   bash scripts/deploy.sh
# Needs: git, Node 20+, MySQL reachable via DATABASE_URL in .env, and (optionally) pm2.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="${APP_NAME:-synapsas}"
PORT="${PORT:-3000}"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created from .env.example. Edit DATABASE_URL, AUTH_SECRET, APP_URL and PLATFORM_ADMIN_KEY, then re-run."
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
npm ci

echo "==> Syncing database schema"
npx prisma db push --skip-generate

if [ "${SEED:-0}" = "1" ]; then
  echo "==> Seeding demo workspace"
  npm run db:seed
fi

echo "==> Building"
npm run build

if command -v pm2 >/dev/null 2>&1; then
  echo "==> Restarting with pm2 ($APP_NAME on port $PORT)"
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
  else
    PORT="$PORT" pm2 start npm --name "$APP_NAME" -- start
  fi
  pm2 save >/dev/null
else
  echo "pm2 not found. Start the app with:  PORT=$PORT npm start   (or: npm i -g pm2 && pm2 start npm --name $APP_NAME -- start)"
fi

echo "==> Done"
