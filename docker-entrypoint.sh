#!/usr/bin/env sh
# Waits for MySQL, syncs the Prisma schema, then starts the Next.js server.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "==> Waiting for the database"
i=0
until echo "SELECT 1;" | node /opt/prisma/node_modules/prisma/build/index.js db execute --url "$DATABASE_URL" --stdin >/dev/null 2>/tmp/dbwait.err; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "Database not reachable after 60 attempts. Last error:" >&2
    cat /tmp/dbwait.err >&2
    exit 1
  fi
  sleep 2
done

echo "==> Syncing database schema"
node /opt/prisma/node_modules/prisma/build/index.js db push --skip-generate

echo "==> Starting ZimStat Approvals on port ${PORT:-3000}"
exec "$@"
