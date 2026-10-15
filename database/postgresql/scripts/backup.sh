#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_BACKUP_URL:?DATABASE_BACKUP_URL is required}"
output_dir="${BACKUP_OUTPUT_DIR:-./backups}"
mkdir -p "$output_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$output_dir/eim_${timestamp}.dump"

umask 077
pg_dump "$DATABASE_BACKUP_URL" --format=custom --compress=9 --no-owner --no-acl --file="$archive"
pg_restore --list "$archive" >/dev/null
sha256sum "$archive" >"$archive.sha256"
printf '{"createdAt":"%s","format":"postgres-custom","archive":"%s"}\n' "$timestamp" "$(basename "$archive")" >"$archive.json"
echo "Backup created and structurally verified: $archive"
