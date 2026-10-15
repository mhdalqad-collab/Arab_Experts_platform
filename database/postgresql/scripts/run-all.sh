#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
postgres_root="$(cd "$script_dir/.." && pwd)"
connection_url="${DATABASE_MIGRATION_URL:-${DATABASE_URL:-}}"
mode="${1:---all}"

if [[ -z "$connection_url" ]]; then
  echo "DATABASE_MIGRATION_URL or DATABASE_URL is required." >&2
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required." >&2
  exit 2
fi
if [[ "$mode" != "--all" && "$mode" != "--migrations-only" && "$mode" != "--seeds-only" ]]; then
  echo "Usage: $0 [--all|--migrations-only|--seeds-only]" >&2
  exit 2
fi

run_directory() {
  local directory="$1"
  local label="$2"
  local file_path
  mapfile -d '' files < <(find "$directory" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)
  echo "Applying ${#files[@]} $label files..."
  for file_path in "${files[@]}"; do
    echo "[$label] $(basename "$file_path")"
    psql "$connection_url" -X -v ON_ERROR_STOP=1 -f "$file_path"
  done
}

if [[ "$mode" == "--all" || "$mode" == "--migrations-only" ]]; then
  run_directory "$postgres_root/migrations" "migration"
fi
if [[ "$mode" == "--all" || "$mode" == "--seeds-only" ]]; then
  run_directory "$postgres_root/seeds" "seed"
fi

echo "PostgreSQL sequence completed successfully."

