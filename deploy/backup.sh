#!/usr/bin/env bash
# Nightly database backup: a compressed dump in deploy/backups, kept 14 days,
# plus an off-site copy when BACKUP_REMOTE (an rclone destination) is set.
# Everything uploaded to the system (posters, slips, certificate templates)
# lives in the database, so this one file is the whole system's data.
#   crontab:  0 3 * * * /path/to/deploy/backup.sh >> /path/to/deploy/backups/backup.log 2>&1
# COMPOSE_ARGS passes extra options to docker compose (e.g. "-p name" for a second copy).
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

mkdir -p backups
file="backups/cpsu_etms-$(date +%Y%m%d-%H%M).sql.gz"
docker compose ${COMPOSE_ARGS:-} exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --default-character-set=utf8mb4 cpsu_etms' \
  | gzip > "$file.part"
mv "$file.part" "$file"
echo "$(date '+%F %T') saved $file ($(du -h "$file" | cut -f1))"

find backups -name 'cpsu_etms-*.sql.gz' -mtime +14 -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$file" "$BACKUP_REMOTE"
  echo "$(date '+%F %T') copied to $BACKUP_REMOTE"
fi
