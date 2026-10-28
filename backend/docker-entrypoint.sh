#!/bin/sh
# Container entrypoint: migrate, optionally seed, then run the API (R7.2, R7.3).
set -e

echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Seeding initial data..."
  node dist/seed/run-seed.js
fi

echo "Starting the API..."
# exec replaces the shell, so node is PID 1 and receives SIGTERM from `docker stop` (R6.4).
exec node dist/main.js
