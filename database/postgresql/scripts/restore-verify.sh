#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must point to a disposable empty PostgreSQL database}"
: "${BACKUP_ARCHIVE:?BACKUP_ARCHIVE is required}"
[[ "${ALLOW_DISPOSABLE_RESTORE:-}" == "YES" ]] || { echo "Set ALLOW_DISPOSABLE_RESTORE=YES after confirming the target is disposable." >&2; exit 2; }
[[ -f "$BACKUP_ARCHIVE" ]] || { echo "Backup archive does not exist." >&2; exit 2; }

pg_restore --list "$BACKUP_ARCHIVE" >/dev/null
existing="$(psql "$RESTORE_DATABASE_URL" -X -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
[[ "$existing" == "0" ]] || { echo "Restore target is not empty; refusing to modify it." >&2; exit 3; }

pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_ARCHIVE"
table_count="$(psql "$RESTORE_DATABASE_URL" -X -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
[[ "$table_count" -ge 500 ]] || { echo "Restored table count is unexpectedly low: $table_count" >&2; exit 4; }
psql "$RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "SELECT current_setting('server_version_num')::int >= 160000" | grep -qx t
echo "Restore verification passed with $table_count application tables."
