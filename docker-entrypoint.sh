#!/usr/bin/env sh
# Waits for MySQL, syncs the Prisma schema, then starts the Next.js server.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "==> Waiting for the database"
i=0
until node node_modules/prisma/build/index.js db execute --url "$DATABASE_URL" --stdin </dev/null >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "Database not reachable after 60 attempts" >&2
    exit 1
  fi
  sleep 2
done

echo "==> Syncing database schema"
node node_modules/prisma/build/index.js db push --skip-generate

echo "==> Starting Synapsas on port ${PORT:-3000}"
exec "$@"
