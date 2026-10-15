BEGIN;

-- Package H completes the asynchronous side of the governed service-case
-- command path. It is additive and keeps the standard workflow MONITOR_ONLY.

CREATE TABLE integration.outbox_dispatch_leases (
  outbox_dispatch_lease_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_event_id uuid NOT NULL
    REFERENCES integration.outbox_events(outbox_event_id) ON DELETE CASCADE,
  lease_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  worker_code varchar(100) NOT NULL,
  lease_status_code varchar(20) NOT NULL DEFAULT 'CLAIMED'
    CHECK (lease_status_code IN ('CLAIMED', 'PUBLISHED', 'RETRY', 'DEAD_LETTER', 'EXPIRED')),
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  error_message text,
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_outbox_lease_period CHECK (lease_expires_at > claimed_at),
  CONSTRAINT ck_outbox_lease_metadata_object
    CHECK (jsonb_typeof(response_metadata) = 'object')
);

CREATE UNIQUE INDEX uq_outbox_active_dispatch_lease
  ON integration.outbox_dispatch_leases(outbox_event_id)
  WHERE lease_status_code = 'CLAIMED';

CREATE INDEX ix_outbox_dispatch_lease_expiry
  ON integration.outbox_dispatch_leases(lease_expires_at)
  WHERE lease_status_code = 'CLAIMED';

CREATE OR REPLACE FUNCTION integration.claim_outbox_events(
  p_worker_code varchar,
  p_batch_size integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  lease_token uuid,
  outbox_event_id uuid,
  aggregate_type varchar,
  aggregate_id uuid,
  event_type varchar,
  event_version integer,
  payload jsonb,
  headers jsonb,
  idempotency_key varchar,
  correlation_id varchar,
  occurred_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, integration
AS $$
BEGIN
  IF nullif(btrim(p_worker_code), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'worker_code is required';
  END IF;
  IF p_batch_size NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'batch_size must be between 1 and 500';
  END IF;
  IF p_lease_seconds NOT BETWEEN 10 AND 3600 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'lease_seconds must be between 10 and 3600';
  END IF;

  UPDATE integration.outbox_dispatch_leases
  SET lease_status_code = 'EXPIRED',
      completed_at = clock_timestamp(),
      error_message = coalesce(error_message, 'LEASE_EXPIRED')
  WHERE lease_status_code = 'CLAIMED'
    AND lease_expires_at <= clock_timestamp();

  RETURN QUERY
  WITH candidates AS (
    SELECT e.outbox_event_id
    FROM integration.outbox_events e
    WHERE e.published_at IS NULL
      AND e.available_at <= clock_timestamp()
      AND NOT EXISTS (
        SELECT 1
        FROM integration.outbox_dispatch_leases l
        WHERE l.outbox_event_id = e.outbox_event_id
          AND l.lease_status_code = 'CLAIMED'
          AND l.lease_expires_at > clock_timestamp()
      )
    ORDER BY e.available_at, e.occurred_at, e.outbox_event_id
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  ),
  leased AS (
    INSERT INTO integration.outbox_dispatch_leases (
      outbox_event_id, worker_code, lease_expires_at
    )
    SELECT
      c.outbox_event_id,
      btrim(p_worker_code),
      clock_timestamp() + make_interval(secs => p_lease_seconds)
    FROM candidates c
    RETURNING
      integration.outbox_dispatch_leases.lease_token,
      integration.outbox_dispatch_leases.outbox_event_id
  )
  SELECT
    l.lease_token,
    e.outbox_event_id,
    e.aggregate_type,
    e.aggregate_id,
    e.event_type,
    e.event_version,
    e.payload,
    e.headers,
    e.idempotency_key,
    e.correlation_id,
    e.occurred_at
  FROM leased l
  JOIN integration.outbox_events e
    ON e.outbox_event_id = l.outbox_event_id
  ORDER BY e.available_at, e.occurred_at, e.outbox_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION integration.complete_outbox_dispatch(
  p_lease_token uuid,
  p_published boolean,
  p_error_message text DEFAULT NULL,
  p_response_metadata jsonb DEFAULT '{}'::jsonb,
  p_max_attempts integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, integration
AS $$
DECLARE
  v_lease integration.outbox_dispatch_leases%ROWTYPE;
  v_attempt_count integer;
  v_terminal boolean;
  v_next_available_at timestamptz;
BEGIN
  IF p_response_metadata IS NULL OR jsonb_typeof(p_response_metadata) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'response_metadata must be a JSON object';
  END IF;
  IF p_max_attempts NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'max_attempts must be between 1 and 50';
  END IF;

  SELECT * INTO v_lease
  FROM integration.outbox_dispatch_leases
  WHERE lease_token = p_lease_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'LEASE_NOT_FOUND');
  END IF;
  IF v_lease.lease_status_code <> 'CLAIMED' THEN
    RETURN jsonb_build_object(
      'status', 'REPLAYED',
      'lease_status', v_lease.lease_status_code,
      'outbox_event_id', v_lease.outbox_event_id
    );
  END IF;
  IF v_lease.lease_expires_at <= clock_timestamp() THEN
    UPDATE integration.outbox_dispatch_leases
    SET lease_status_code = 'EXPIRED',
        completed_at = clock_timestamp(),
        error_message = coalesce(p_error_message, 'LEASE_EXPIRED'),
        response_metadata = p_response_metadata
    WHERE outbox_dispatch_lease_id = v_lease.outbox_dispatch_lease_id;
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'LEASE_EXPIRED');
  END IF;

  UPDATE integration.outbox_events
  SET attempt_count = attempt_count + 1,
      published_at = CASE WHEN p_published THEN clock_timestamp() ELSE published_at END,
      last_error = CASE WHEN p_published THEN NULL ELSE left(coalesce(p_error_message, 'DISPATCH_FAILED'), 4000) END
  WHERE outbox_event_id = v_lease.outbox_event_id
  RETURNING attempt_count INTO v_attempt_count;

  v_terminal := NOT p_published AND v_attempt_count >= p_max_attempts;
  v_next_available_at :=
    clock_timestamp() + make_interval(secs => least(3600, 5 * (2 ^ least(v_attempt_count, 9))::integer));

  UPDATE integration.outbox_events
  SET available_at = CASE
    WHEN p_published OR v_terminal THEN available_at
    ELSE v_next_available_at
  END
  WHERE outbox_event_id = v_lease.outbox_event_id;

  UPDATE integration.outbox_dispatch_leases
  SET lease_status_code = CASE
        WHEN p_published THEN 'PUBLISHED'
        WHEN v_terminal THEN 'DEAD_LETTER'
        ELSE 'RETRY'
      END,
      completed_at = clock_timestamp(),
      error_message = CASE WHEN p_published THEN NULL ELSE left(coalesce(p_error_message, 'DISPATCH_FAILED'), 4000) END,
      response_metadata = p_response_metadata
  WHERE outbox_dispatch_lease_id = v_lease.outbox_dispatch_lease_id;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN p_published THEN 'PUBLISHED'
      WHEN v_terminal THEN 'DEAD_LETTER'
      ELSE 'RETRY_SCHEDULED'
    END,
    'outbox_event_id', v_lease.outbox_event_id,
    'attempt_count', v_attempt_count,
    'next_available_at', CASE WHEN p_published OR v_terminal THEN NULL ELSE v_next_available_at END
  );
END;
$$;

CREATE OR REPLACE FUNCTION delivery.resume_approved_service_case_transition(
  p_approval_request_id uuid,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, integration
AS $$
DECLARE
  v_approval governance.approval_requests%ROWTYPE;
  v_attempt delivery.service_case_transition_attempts%ROWTYPE;
  v_case delivery.service_cases%ROWTYPE;
  v_outbox_event_id uuid;
  v_new_row_version bigint;
BEGIN
  SELECT * INTO v_approval
  FROM governance.approval_requests
  WHERE approval_request_id = p_approval_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'APPROVAL_NOT_FOUND');
  END IF;
  IF v_approval.status_code <> 'APPROVED' THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'code', 'APPROVAL_NOT_APPROVED',
      'approval_status', v_approval.status_code
    );
  END IF;

  SELECT a.* INTO v_attempt
  FROM delivery.service_case_transition_attempts a
  JOIN delivery.service_case_transition_approvals l
    ON l.service_case_transition_attempt_id = a.service_case_transition_attempt_id
  WHERE l.approval_request_id = p_approval_request_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'TRANSITION_ATTEMPT_NOT_FOUND');
  END IF;
  IF v_attempt.executed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'REPLAYED',
      'code', 'TRANSITION_ALREADY_EXECUTED',
      'transition_attempt_id', v_attempt.service_case_transition_attempt_id
    );
  END IF;

  SELECT * INTO v_case
  FROM delivery.service_cases
  WHERE service_case_id = v_attempt.service_case_id
  FOR UPDATE;

  IF v_case.lifecycle_stage_code <> v_attempt.from_stage_code THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'code', 'CASE_STAGE_CHANGED',
      'expected_stage', v_attempt.from_stage_code,
      'current_stage', v_case.lifecycle_stage_code
    );
  END IF;

  UPDATE delivery.service_cases
  SET lifecycle_stage_code = v_attempt.requested_to_stage_code,
      lifecycle_status_code = CASE
        WHEN v_attempt.requested_to_stage_code = 'CLOSED' THEN 'COMPLETED'
        WHEN v_attempt.requested_to_stage_code = 'CANCELLED' THEN 'CANCELLED'
        ELSE lifecycle_status_code
      END,
      completed_at = CASE
        WHEN v_attempt.requested_to_stage_code IN ('CLOSED', 'CANCELLED')
          THEN coalesce(completed_at, clock_timestamp())
        ELSE completed_at
      END,
      closed_at = CASE
        WHEN v_attempt.requested_to_stage_code = 'CLOSED'
          THEN coalesce(closed_at, clock_timestamp())
        ELSE closed_at
      END
  WHERE service_case_id = v_attempt.service_case_id
  RETURNING row_version INTO v_new_row_version;

  INSERT INTO delivery.service_case_stage_events (
    service_case_id, from_stage_code, to_stage_code, reason_code,
    comment, changed_by_party_id, is_automatic,
    source_event_table, source_event_id, correlation_id, occurred_at
  )
  VALUES (
    v_attempt.service_case_id, v_attempt.from_stage_code,
    v_attempt.requested_to_stage_code, 'APPROVAL_COMPLETED',
    'تم تنفيذ الانتقال بعد اكتمال الموافقة المحكومة.',
    v_approval.requested_by_party_id, true,
    'governance.approval_requests', p_approval_request_id,
    coalesce(p_correlation_id, v_attempt.correlation_id), clock_timestamp()
  );

  INSERT INTO integration.outbox_events (
    aggregate_type, aggregate_id, event_type, event_version,
    payload, headers, idempotency_key, correlation_id
  )
  VALUES (
    'SERVICE_CASE', v_attempt.service_case_id,
    'SERVICE_CASE_TRANSITION_APPROVED_AND_EXECUTED', 1,
    jsonb_build_object(
      'service_case_id', v_attempt.service_case_id,
      'from_stage_code', v_attempt.from_stage_code,
      'to_stage_code', v_attempt.requested_to_stage_code,
      'transition_attempt_id', v_attempt.service_case_transition_attempt_id,
      'approval_request_id', p_approval_request_id,
      'row_version', v_new_row_version
    ),
    jsonb_build_object('approval_request_id', p_approval_request_id),
    'service-case-approval:' || p_approval_request_id::text,
    coalesce(p_correlation_id, v_attempt.correlation_id)
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING outbox_event_id INTO v_outbox_event_id;

  INSERT INTO delivery.service_case_transition_outbox_links (
    service_case_transition_attempt_id, outbox_event_id, event_role_code
  )
  VALUES (
    v_attempt.service_case_transition_attempt_id,
    v_outbox_event_id,
    'TRANSITION_RESULT'
  )
  ON CONFLICT (service_case_transition_attempt_id, event_role_code) DO NOTHING;

  UPDATE delivery.service_case_transition_attempts
  SET executed_at = clock_timestamp(),
      sod_check_passed = true
  WHERE service_case_transition_attempt_id = v_attempt.service_case_transition_attempt_id;

  UPDATE delivery.service_case_command_receipts r
  SET command_status_code = 'SUCCEEDED',
      response_code = 'APPROVED_AND_EXECUTED',
      response_snapshot = coalesce(r.response_snapshot, '{}'::jsonb) ||
        jsonb_build_object(
          'status', 'SUCCEEDED',
          'executed', true,
          'approval_request_id', p_approval_request_id,
          'row_version', v_new_row_version
        ),
      completed_at = clock_timestamp()
  WHERE r.service_case_command_receipt_id =
        v_attempt.service_case_command_receipt_id;

  RETURN jsonb_build_object(
    'status', 'SUCCEEDED',
    'code', 'APPROVED_AND_EXECUTED',
    'service_case_id', v_attempt.service_case_id,
    'transition_attempt_id', v_attempt.service_case_transition_attempt_id,
    'outbox_event_id', v_outbox_event_id,
    'row_version', v_new_row_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION governance.decide_service_case_transition_approval(
  p_approval_request_id uuid,
  p_approver_user_account_id uuid,
  p_decision_code varchar,
  p_decision_reason text DEFAULT NULL,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, governance, delivery, iam
AS $$
DECLARE
  v_approver_party_id uuid;
  v_request governance.approval_requests%ROWTYPE;
  v_approve_count integer;
  v_reject_count integer;
  v_new_status varchar(20);
BEGIN
  IF p_decision_code NOT IN ('APPROVE', 'REJECT', 'RETURN', 'ABSTAIN') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported approval decision';
  END IF;
  IF p_decision_code IN ('REJECT', 'RETURN')
     AND nullif(btrim(p_decision_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A reason is required';
  END IF;

  SELECT a.party_id INTO v_approver_party_id
  FROM iam.user_accounts a
  WHERE a.user_account_id = p_approver_user_account_id
    AND a.status_code = 'ACTIVE';

  IF v_approver_party_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM governance.user_role_assignments ura
    JOIN governance.roles r ON r.role_id = ura.role_id
    WHERE ura.user_account_id = p_approver_user_account_id
      AND ura.status_code = 'ACTIVE'
      AND ura.valid_from <= clock_timestamp()
      AND (ura.valid_to IS NULL OR ura.valid_to > clock_timestamp())
      AND r.role_code IN ('PLATFORM_OPERATOR', 'PLATFORM_ADMIN')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Workflow approver role is required';
  END IF;

  SELECT * INTO v_request
  FROM governance.approval_requests
  WHERE approval_request_id = p_approval_request_id
    AND request_type_code = 'SERVICE_CASE_TRANSITION'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'APPROVAL_NOT_FOUND');
  END IF;
  IF v_request.status_code NOT IN ('PENDING', 'PARTIALLY_APPROVED') THEN
    RETURN jsonb_build_object(
      'status', 'REPLAYED',
      'approval_status', v_request.status_code
    );
  END IF;
  IF v_request.expires_at IS NOT NULL AND v_request.expires_at <= clock_timestamp() THEN
    UPDATE governance.approval_requests
    SET status_code = 'EXPIRED', decided_at = clock_timestamp()
    WHERE approval_request_id = p_approval_request_id;
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'APPROVAL_EXPIRED');
  END IF;

  INSERT INTO governance.approval_decisions (
    approval_request_id, approver_party_id, decision_code, decision_reason
  )
  VALUES (
    p_approval_request_id, v_approver_party_id,
    p_decision_code, nullif(btrim(p_decision_reason), '')
  )
  ON CONFLICT (approval_request_id, approver_party_id) DO NOTHING;

  SELECT
    count(*) FILTER (WHERE decision_code = 'APPROVE'),
    count(*) FILTER (WHERE decision_code IN ('REJECT', 'RETURN'))
  INTO v_approve_count, v_reject_count
  FROM governance.approval_decisions
  WHERE approval_request_id = p_approval_request_id;

  v_new_status := CASE
    WHEN v_reject_count > 0 THEN 'REJECTED'
    WHEN v_approve_count >= v_request.minimum_approvals THEN 'APPROVED'
    WHEN v_approve_count > 0 THEN 'PARTIALLY_APPROVED'
    ELSE 'PENDING'
  END;

  UPDATE governance.approval_requests
  SET status_code = v_new_status,
      decided_at = CASE
        WHEN v_new_status IN ('APPROVED', 'REJECTED') THEN clock_timestamp()
        ELSE decided_at
      END
  WHERE approval_request_id = p_approval_request_id;

  IF v_new_status = 'APPROVED' THEN
    RETURN delivery.resume_approved_service_case_transition(
      p_approval_request_id, p_correlation_id
    ) || jsonb_build_object('approval_status', v_new_status);
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_new_status = 'REJECTED' THEN 'REJECTED' ELSE 'PENDING' END,
    'approval_status', v_new_status,
    'approve_count', v_approve_count,
    'minimum_approvals', v_request.minimum_approvals
  );
END;
$$;

CREATE VIEW integration.v_outbox_dispatch_operations AS
SELECT
  e.outbox_event_id,
  e.aggregate_type,
  e.aggregate_id,
  e.event_type,
  e.idempotency_key,
  e.available_at,
  e.published_at,
  e.attempt_count,
  e.last_error,
  l.worker_code,
  l.lease_status_code,
  l.claimed_at,
  l.lease_expires_at,
  l.completed_at
FROM integration.outbox_events e
LEFT JOIN LATERAL (
  SELECT dl.*
  FROM integration.outbox_dispatch_leases dl
  WHERE dl.outbox_event_id = e.outbox_event_id
  ORDER BY dl.claimed_at DESC
  LIMIT 1
) l ON true;

COMMENT ON FUNCTION integration.claim_outbox_events(varchar, integer, integer) IS
  'Claims a bounded batch with SKIP LOCKED and expiring leases for concurrent publishers.';
COMMENT ON FUNCTION integration.complete_outbox_dispatch(uuid, boolean, text, jsonb, integer) IS
  'Idempotently acknowledges publication or schedules exponential retry/dead-letter.';
COMMENT ON FUNCTION governance.decide_service_case_transition_approval(uuid, uuid, varchar, text, varchar) IS
  'Records a separated, role-checked decision and resumes the transition after quorum.';

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0270_v79_approval_resume_outbox_dispatch')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
