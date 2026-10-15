#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required and must point to a disposable PostgreSQL 16+ database}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for sql_file in "$root"/migrations/*.sql; do
  base="$(basename "$sql_file")"
  if [[ "$base" < "0230_" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
  fi
done

for sql_file in "$root"/seeds/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
done

for sql_file in "$root"/migrations/*.sql; do
  base="$(basename "$sql_file")"
  if [[ ! "$base" < "0230_" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
  fi
done

for test_file in "$root"/tests/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$test_file"
done

bash "$root/tests/003_outbox_concurrency.sh"

echo "PostgreSQL integration suite passed."
