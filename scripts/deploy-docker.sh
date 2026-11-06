#!/usr/bin/env bash
# Pull the latest code and rebuild/restart the Docker stack (app on :3443, MySQL).
#   bash scripts/deploy-docker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.docker.example .env
  echo ".env created from .env.docker.example. Set DB_PASSWORD, DB_ROOT_PASSWORD, AUTH_SECRET, CRON_SECRET and APP_URL, then re-run."
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting containers"
docker compose up -d --build --remove-orphans

echo "==> Pruning old images"
docker image prune -f >/dev/null

docker compose ps
echo "==> Done. App on 127.0.0.1:3443 behind nginx at $(grep -E '^APP_URL=' .env | cut -d= -f2)"
