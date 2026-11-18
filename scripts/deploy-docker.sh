#!/usr/bin/env bash
# The one command to run on the server. Pulls the latest code, rebuilds and restarts the Docker stack (app on :3443,
# PostgreSQL 16), waits until the app has synced the database schema, and makes sure the organisation and the
# administrator account exist (prisma/seed-admin.ts; nothing else is seeded).
#   bash scripts/deploy-docker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.docker.example .env
  echo ".env created from .env.docker.example. Set DB_PASSWORD, AUTH_SECRET, APP_URL, DOMAIN and the ADMIN_* values, then re-run."
  exit 1
fi
for v in DB_PASSWORD AUTH_SECRET; do
  if ! grep -Eq "^$v=.+" .env || grep -Eq "^$v=change-me" .env; then
    echo "Set $v in .env before deploying."
    exit 1
  fi
done
if grep -Eq '^DB_PASSWORD=.*[^A-Za-z0-9_.-]' .env; then
  echo "DB_PASSWORD may only contain letters, digits, '.', '_' and '-' (it is placed inside the database URL)."
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting containers"
docker compose up -d --build --remove-orphans

echo "==> Waiting for the app to come up (it syncs the database schema on start)"
app_id="$(docker compose ps -q app)"
for _ in $(seq 1 60); do
  state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$app_id" 2>/dev/null || true)"
  if [ "$state" = "healthy" ]; then break; fi
  if [ "$state" = "exited" ] || [ "$state" = "dead" ]; then
    echo "The app container stopped. Last log lines:"; docker compose logs --tail=40 app; exit 1
  fi
  sleep 5
done
if [ "${state:-}" != "healthy" ]; then
  echo "The app is not healthy yet (state: ${state:-unknown}). Continuing; check 'docker compose logs app' if it stays that way."
fi

echo "==> Making sure the organisation and the administrator account exist"
docker compose --profile seed run --rm seed

echo "==> Pruning old images"
docker image prune -f >/dev/null

docker compose ps
echo "==> Done. App: http://$(hostname -I | awk '{print $1}'):3443  and  https://$(grep -E '^DOMAIN=' .env | cut -d= -f2)"
