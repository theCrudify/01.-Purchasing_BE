#!/usr/bin/env bash
# Rebuild a local throwaway DB from migrations in order. Usage: ./reset-local.sh <dbname> [port]
# INCLUDE=<grep -E regex> limits which migration files run (0001/0002 always run), e.g. INCLUDE="^03"
set -euo pipefail
DB=${1:?db name}; PORT=${2:-54329}; P="psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" -c "CREATE DATABASE \"$DB\""
cd "$(dirname "$0")/migrations"
for f in $(ls *.sql | sort | grep -E "^000[12]_|${INCLUDE:-.}"); do $P -d "$DB" -f "$f" 2>&1 | grep -v NOTICE || true; done
echo "ok: $DB"
