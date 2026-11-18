#!/usr/bin/env bash
# Compressed PostgreSQL dump of the Docker stack into backups/ (keeps the last 14 by default).
#   bash scripts/backup-db.sh            # one backup
#   crontab: 0 2 * * * cd /path/to/app && bash scripts/backup-db.sh >> backups/backup.log 2>&1
# Restore: gunzip -c backups/approvals-YYYY-MM-DD-HHMM.sql.gz | docker compose exec -T db psql -U synapsas -d approvals
set -euo pipefail
cd "$(dirname "$0")/.."
KEEP="${KEEP:-14}"
DB_USER="$(grep -E '^DB_USER=' .env | cut -d= -f2 | tr -d '[:space:]')"; DB_USER="${DB_USER:-synapsas}"
DB_NAME="$(grep -E '^DB_NAME=' .env | cut -d= -f2 | tr -d '[:space:]')"; DB_NAME="${DB_NAME:-approvals}"
mkdir -p backups
out="backups/${DB_NAME}-$(date +%Y-%m-%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges | gzip -9 > "$out"
echo "$(date -Is) wrote $out ($(du -h "$out" | cut -f1))"
ls -1t backups/"${DB_NAME}"-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
