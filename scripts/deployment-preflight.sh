#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${1:-$root/deployment/.env}"
failures=0

fail(){ echo "[FAIL] $*" >&2; failures=$((failures+1)); }
pass(){ echo "[PASS] $*"; }

for file in package.json package-lock.json Dockerfile.backend Dockerfile.frontend deployment/docker-compose.yml openapi/eim-v113-backend-r5.yaml; do
  [[ -s "$root/$file" ]] && pass "$file exists" || fail "$file is missing"
done

[[ -f "$env_file" ]] || { fail "$env_file is missing; copy deployment/.env.example first"; exit 1; }
set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

required=(POSTGRES_PASSWORD IDENTITY_ISSUER_URL IDENTITY_JWKS_URL IDENTITY_AUDIENCE IDENTITY_PROVIDER_CODE OBJECT_STORAGE_UPLOAD_BASE_URL OBJECT_STORAGE_CALLBACK_TOKEN MALWARE_SCANNER_TOKEN NOTIFICATION_DISPATCHER_TOKEN POSTGRES_OPERATIONS_API_TOKEN)
for name in "${required[@]}"; do
  value="${!name:-}"
  if [[ -z "$value" || "$value" == *replace_* || "$value" == *example.invalid* ]]; then fail "$name is unset or still a placeholder"; else pass "$name is configured"; fi
done

for name in OBJECT_STORAGE_CALLBACK_TOKEN MALWARE_SCANNER_TOKEN NOTIFICATION_DISPATCHER_TOKEN POSTGRES_OPERATIONS_API_TOKEN; do
  value="${!name:-}"
  [[ "${#value}" -ge 32 ]] && pass "$name length is acceptable" || fail "$name must contain at least 32 characters"
done

[[ "${APP_ENV:-}" == "production" || "${APP_ENV:-}" == "staging" ]] && pass "APP_ENV is deployment-safe" || fail "APP_ENV must be production or staging"
[[ "${POSTGRES_OPERATIONS_ACTIONS_ENABLED:-false}" == "false" ]] && pass "dangerous operations start disabled" || fail "POSTGRES_OPERATIONS_ACTIONS_ENABLED must remain false for initial deployment"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose --env-file "$env_file" -f "$root/deployment/docker-compose.yml" config --quiet && pass "Docker Compose configuration is valid" || fail "Docker Compose configuration is invalid"
else
  echo "[SKIP] Docker Compose runtime is unavailable; static checks only"
fi

((failures == 0)) || { echo "Preflight failed with $failures issue(s)." >&2; exit 1; }
echo "Deployment preflight passed."
