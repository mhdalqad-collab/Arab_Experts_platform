\set ON_ERROR_STOP on

BEGIN;

INSERT INTO integration.outbox_events (
  outbox_event_id, aggregate_type, aggregate_id, event_type,
  payload, idempotency_key, available_at
)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  'INTEGRATION_TEST',
  '80000000-0000-0000-0000-000000000002',
  'INTEGRATION_TEST_EVENT',
  '{"test":true}'::jsonb,
  'integration-test-outbox-v80',
  clock_timestamp() - interval '1 minute'
);

SELECT lease_token
FROM integration.claim_outbox_events('integration-test-worker', 1, 60)
\gset

SELECT set_config('eim.test_lease_token', :'lease_token', true);

DO $$
BEGIN
  IF nullif(current_setting('eim.test_lease_token', true), '') IS NULL THEN
    RAISE EXCEPTION 'Expected an outbox lease';
  END IF;
END
$$;

SELECT integration.complete_outbox_dispatch(
  :'lease_token'::uuid, true, NULL, '{"transport":"test"}'::jsonb, 3
);

DO $$
DECLARE
  v_event integration.outbox_events%ROWTYPE;
  v_lease integration.outbox_dispatch_leases%ROWTYPE;
BEGIN
  SELECT * INTO v_event
  FROM integration.outbox_events
  WHERE outbox_event_id = '80000000-0000-0000-0000-000000000001';

  IF v_event.published_at IS NULL OR v_event.attempt_count <> 1 THEN
    RAISE EXCEPTION 'Publish acknowledgement was not persisted exactly once';
  END IF;

  SELECT * INTO v_lease
  FROM integration.outbox_dispatch_leases
  WHERE lease_token =
    current_setting('eim.test_lease_token', true)::uuid;

  IF v_lease.lease_status_code <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'Expected PUBLISHED lease status';
  END IF;
END
$$;

-- Replaying completion must not increment the event attempt count.
SELECT integration.complete_outbox_dispatch(
  :'lease_token'::uuid, true, NULL, '{}'::jsonb, 3
);

DO $$
BEGIN
  IF (
    SELECT attempt_count
    FROM integration.outbox_events
    WHERE outbox_event_id = '80000000-0000-0000-0000-000000000001'
  ) <> 1 THEN
    RAISE EXCEPTION 'Replayed completion incremented attempt_count';
  END IF;
END
$$;

ROLLBACK;
