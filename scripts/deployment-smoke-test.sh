#!/usr/bin/env bash
set -euo pipefail

backend_url="${BACKEND_URL:-http://127.0.0.1:8788}"
frontend_url="${FRONTEND_URL:-http://127.0.0.1:3000}"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT

probe(){
  local name="$1" url="$2" expected="$3"
  code="$(curl --silent --show-error --location --output "$temporary/$name.json" --write-out '%{http_code}' --max-time 10 "$url")"
  [[ "$code" == "$expected" ]] || { echo "$name returned HTTP $code; expected $expected" >&2; cat "$temporary/$name.json" >&2; exit 1; }
  echo "[PASS] $name HTTP $code"
}

probe backend-live "$backend_url/health/live" 200
probe backend-ready "$backend_url/health/ready" 200
probe backend-meta "$backend_url/v1/meta" 200
probe frontend-root "$frontend_url/" 200

python3 - "$temporary" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1])
assert json.loads((p/'backend-live.json').read_text())['status']=='ok'
assert json.loads((p/'backend-ready.json').read_text())['status']=='ready'
assert json.loads((p/'backend-meta.json').read_text())['data']['systemOfRecord']=='PostgreSQL 16'
print('[PASS] response contracts')
PY

echo "Deployment smoke tests passed."
