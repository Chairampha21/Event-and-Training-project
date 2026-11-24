#!/usr/bin/env bash
# Start the local MySQL for development.
#
# In Codespaces a restart can lose a container's own filesystem layer
# ("RWLayer of container ... is unexpectedly nil"), so `docker start` fails.
# The data lives in a separate Docker volume and survives, so when starting
# fails this removes the broken container (never the volume) and creates a
# new one on the same volume.
set -euo pipefail

NAME=cpsu-etms-mysql
# The volume holding /var/lib/mysql. Override with DB_VOLUME=... if yours differs.
VOLUME=${DB_VOLUME:-cpsu-etms-mysql-data}

if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = "true" ]; then
  echo "$NAME is already running."
  exit 0
fi

if docker start "$NAME" >/dev/null 2>&1; then
  echo "Started $NAME."
else
  if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
    echo "Data volume $VOLUME not found; not touching anything." >&2
    exit 1
  fi
  echo "Could not start $NAME; recreating it on volume $VOLUME (data is kept)."
  docker rm -f "$NAME" >/dev/null 2>&1 || true   # no -v: the volume stays
  docker run -d --name "$NAME" -p 3306:3306 \
    -e MYSQL_DATABASE=cpsu_etms -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
    -v "$VOLUME":/var/lib/mysql mysql:8.0 >/dev/null
fi

printf 'Waiting for MySQL'
for _ in $(seq 1 60); do
  if docker exec "$NAME" mysqladmin ping -uroot --silent >/dev/null 2>&1; then
    echo " ready."
    exit 0
  fi
  printf '.'
  sleep 2
done
echo " not ready after 2 minutes; see: docker logs $NAME" >&2
exit 1
