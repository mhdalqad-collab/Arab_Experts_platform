#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

event_id="80000000-0000-0000-0000-000000000011"
aggregate_id="80000000-0000-0000-0000-000000000012"
key="integration-test-concurrency-v80"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM integration.outbox_events WHERE outbox_event_id = '\''80000000-0000-0000-0000-000000000011'\''" >/dev/null 2>&1 || true' EXIT

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM integration.outbox_events WHERE outbox_event_id = '$event_id';
INSERT INTO integration.outbox_events (
  outbox_event_id, aggregate_type, aggregate_id, event_type,
  payload, idempotency_key, available_at
) VALUES (
  '$event_id', 'INTEGRATION_TEST', '$aggregate_id',
  'CONCURRENCY_TEST_EVENT', '{"test":true}'::jsonb, '$key',
  clock_timestamp() - interval '1 minute'
);
SQL

claim_sql="SELECT count(*) FROM integration.claim_outbox_events('concurrency-worker', 1, 60);"
psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "$claim_sql" >"$tmp_dir/a" &
pid_a=$!
psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "$claim_sql" >"$tmp_dir/b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

claimed_total=$(( $(tr -d '[:space:]' <"$tmp_dir/a") + $(tr -d '[:space:]' <"$tmp_dir/b") ))
if [[ "$claimed_total" -ne 1 ]]; then
  echo "Expected exactly one concurrent claim, got $claimed_total" >&2
  exit 1
fi

active_leases="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c \
  "SELECT count(*) FROM integration.outbox_dispatch_leases WHERE outbox_event_id = '$event_id' AND lease_status_code = 'CLAIMED';")"
if [[ "$active_leases" -ne 1 ]]; then
  echo "Expected exactly one active lease, got $active_leases" >&2
  exit 1
fi

echo "Outbox concurrency test passed."
