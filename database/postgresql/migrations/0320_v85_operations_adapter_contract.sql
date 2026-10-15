BEGIN;

-- Package N exposes one stable, audited contract to the operations adapter.
-- The adapter authenticates the operator; PostgreSQL rechecks identity and role.

CREATE TABLE delivery.workflow_operations_command_receipts (
  workflow_operations_command_receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key varchar(120) NOT NULL UNIQUE,
  command_code varchar(32) NOT NULL CHECK (command_code IN (
    'EVALUATE_WINDOW', 'PAUSE_ROLLOUT', 'EMERGENCY_STOP', 'REQUEST_PROMOTION'
  )),
  rollout_plan_id uuid NOT NULL REFERENCES delivery.service_workflow_rollout_plans(
    service_workflow_rollout_plan_id
  ) ON DELETE RESTRICT,
  actor_user_account_id uuid NOT NULL REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
  request_hash varchar(64) NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 8),
  status_code varchar(20) NOT NULL DEFAULT 'RECEIVED' CHECK (status_code IN (
    'RECEIVED', 'SUCCEEDED', 'REJECTED', 'FAILED'
  )),
  result_payload jsonb,
  correlation_id varchar(120),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz
);

CREATE INDEX ix_workflow_operations_receipts_plan_time
  ON delivery.workflow_operations_command_receipts(rollout_plan_id, received_at DESC);

CREATE OR REPLACE FUNCTION delivery.get_workflow_operations_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, integration
AS $$
  WITH latest_plan AS (
    SELECT p.* FROM delivery.service_workflow_rollout_plans p
    ORDER BY p.updated_at DESC LIMIT 1
  ), latest_window AS (
    SELECT w.* FROM delivery.service_workflow_rollout_windows w
    JOIN latest_plan p ON p.service_workflow_rollout_plan_id = w.service_workflow_rollout_plan_id
    ORDER BY w.window_no DESC LIMIT 1
  ), latest_recommendation AS (
    SELECT r.* FROM delivery.service_workflow_rollout_recommendations r
    JOIN latest_plan p ON p.service_workflow_rollout_plan_id = r.service_workflow_rollout_plan_id
    ORDER BY r.created_at DESC LIMIT 1
  ), outbox AS (
    SELECT
      count(*) FILTER (WHERE published_at IS NULL)::integer AS unpublished,
      (SELECT count(DISTINCT dl.outbox_event_id)::integer
       FROM integration.outbox_dispatch_leases dl
       WHERE dl.lease_status_code = 'DEAD_LETTER') AS dead_letters
    FROM integration.outbox_events
  )
  SELECT jsonb_build_object(
    'contractVersion', '1.0',
    'rollout', (SELECT jsonb_build_object(
      'planId', service_workflow_rollout_plan_id,
      'planCode', plan_code,
      'status', rollout_status_code,
      'percentage', current_percentage,
      'emergencyStopActive', emergency_stop_active
    ) FROM latest_plan),
    'window', (SELECT jsonb_build_object(
      'id', service_workflow_rollout_window_id,
      'number', window_no,
      'attempts', evaluated_attempt_count,
      'blockRate', block_rate,
      'errorRate', error_rate,
      'p95LatencyMs', p95_latency_ms
    ) FROM latest_window),
    'recommendation', (SELECT jsonb_build_object(
      'code', recommendation_code,
      'reasons', reasons,
      'createdAt', created_at
    ) FROM latest_recommendation),
    'outbox', (SELECT jsonb_build_object(
      'unpublished', unpublished, 'deadLetters', dead_letters
    ) FROM outbox),
    'capabilities', jsonb_build_object(
      'actions', true,
      'stepUpRequired', true,
      'separationOfDuties', true
    ),
    'generatedAt', clock_timestamp()
  );
$$;

CREATE OR REPLACE FUNCTION delivery.execute_workflow_operations_command(
  p_idempotency_key varchar,
  p_command_code varchar,
  p_rollout_plan_id uuid,
  p_actor_user_account_id uuid,
  p_reason text,
  p_step_up_verified boolean,
  p_target_percentage numeric DEFAULT NULL,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, iam
AS $$
DECLARE
  v_hash varchar(64);
  v_receipt delivery.workflow_operations_command_receipts%ROWTYPE;
  v_result jsonb;
BEGIN
  IF nullif(btrim(p_idempotency_key), '') IS NULL OR length(p_idempotency_key) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Valid idempotency key is required';
  END IF;
  IF p_command_code NOT IN ('EVALUATE_WINDOW','PAUSE_ROLLOUT','EMERGENCY_STOP','REQUEST_PROMOTION') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported operations command';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL OR length(btrim(p_reason)) < 8 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operational reason must contain at least 8 characters';
  END IF;
  IF NOT p_step_up_verified THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Trusted step-up verification is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM iam.user_accounts a
    JOIN governance.user_role_assignments ura ON ura.user_account_id = a.user_account_id
    JOIN governance.roles r ON r.role_id = ura.role_id
    WHERE a.user_account_id = p_actor_user_account_id AND a.status_code = 'ACTIVE'
      AND ura.status_code = 'ACTIVE' AND ura.valid_from <= clock_timestamp()
      AND (ura.valid_to IS NULL OR ura.valid_to > clock_timestamp())
      AND r.role_code = 'PLATFORM_ADMIN'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Platform administrator role is required';
  END IF;

  v_hash := encode(digest(concat_ws('|', p_command_code, p_rollout_plan_id::text,
    coalesce(p_target_percentage::text,''), btrim(p_reason)), 'sha256'), 'hex');
  SELECT * INTO v_receipt FROM delivery.workflow_operations_command_receipts
  WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.request_hash <> v_hash THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Idempotency key was reused with a different request';
    END IF;
    RETURN coalesce(v_receipt.result_payload, jsonb_build_object('status', v_receipt.status_code));
  END IF;

  INSERT INTO delivery.workflow_operations_command_receipts(
    idempotency_key, command_code, rollout_plan_id, actor_user_account_id,
    request_hash, reason, correlation_id
  ) VALUES (p_idempotency_key, p_command_code, p_rollout_plan_id,
    p_actor_user_account_id, v_hash, btrim(p_reason), p_correlation_id)
  RETURNING * INTO v_receipt;

  IF p_command_code = 'EVALUATE_WINDOW' THEN
    v_result := delivery.evaluate_service_workflow_rollout_window(
      p_rollout_plan_id, p_actor_user_account_id, p_correlation_id);
  ELSIF p_command_code IN ('PAUSE_ROLLOUT', 'EMERGENCY_STOP') THEN
    v_result := delivery.apply_service_workflow_rollout_action(
      p_rollout_plan_id, p_actor_user_account_id, 'PAUSE', p_reason,
      NULL, true, p_correlation_id);
  ELSE
    -- Promotion is deliberately a review request, never an automatic activation.
    v_result := jsonb_build_object('status','PENDING_REVIEW','code','HUMAN_APPROVAL_REQUIRED',
      'targetPercentage', p_target_percentage);
  END IF;

  UPDATE delivery.workflow_operations_command_receipts
  SET status_code = CASE WHEN v_result->>'status' IN ('REJECTED','FAILED')
      THEN v_result->>'status' ELSE 'SUCCEEDED' END,
      result_payload = v_result, completed_at = clock_timestamp()
  WHERE workflow_operations_command_receipt_id = v_receipt.workflow_operations_command_receipt_id;
  RETURN v_result;
END;
$$;

COMMIT;
