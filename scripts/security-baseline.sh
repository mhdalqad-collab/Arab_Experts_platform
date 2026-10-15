#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
failures=0
fail(){ echo "[FAIL] $*" >&2; failures=$((failures+1)); }
pass(){ echo "[PASS] $*"; }

[[ -f package-lock.json ]] && pass "dependency lockfile exists" || fail "package-lock.json is missing"
[[ -f .dockerignore ]] && pass "Docker build context is bounded" || fail ".dockerignore is missing"
rg -q '^USER node$' Dockerfile.backend && pass "Backend runs as non-root" || fail "Backend container lacks USER node"
rg -q '^USER node$' Dockerfile.frontend && pass "Frontend runs as non-root" || fail "Frontend container lacks USER node"
rg -q 'location /internal/ \{ return 404; \}' deployment/nginx.conf.template && pass "Internal callbacks are not publicly proxied" || fail "Reverse proxy exposes internal callbacks"
rg -q 'internal: true' deployment/docker-compose.yml && pass "Database network is private" || fail "Database network is not private"

secret_pattern='(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{30,}|sk_live_[A-Za-z0-9]{20,})'
if rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!backend/dist/**' --glob '!*.zip' --glob '!.git/**' "$secret_pattern" . >/tmp/eim-secret-findings.txt; then
  cat /tmp/eim-secret-findings.txt >&2
  fail "possible production secret detected"
else
  pass "no recognized production secret pattern detected"
fi

if rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!backend/dist/**' 'eval\(|new Function\(' app backend/src scripts; then
  fail "dynamic code execution primitive detected"
else
  pass "no dynamic code execution primitive detected"
fi

node scripts/validate-openapi.mjs >/dev/null && pass "API contracts pass" || fail "API contract validation failed"

((failures == 0)) || { echo "Security baseline failed with $failures issue(s)." >&2; exit 1; }
echo "Security baseline passed."
