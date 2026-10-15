BEGIN;

-- Package K preserves the V78 executor as an immediate rollback target and
-- installs a rollout-aware executor under the canonical function name.

ALTER FUNCTION delivery.execute_service_case_command(
  uuid, uuid, varchar, varchar, varchar, bigint, text, boolean, varchar, jsonb
) RENAME TO execute_service_case_command_v78;

CREATE OR REPLACE FUNCTION delivery.execute_service_case_command(
  p_service_case_id uuid,
  p_actor_user_account_id uuid,
  p_idempotency_key varchar,
  p_command_code varchar,
  p_requested_to_stage_code varchar,
  p_expected_row_version bigint,
  p_reason text DEFAULT NULL,
  p_step_up_verified boolean DEFAULT false,
  p_correlation_id varchar DEFAULT NULL,
  p_request_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, integration, iam, core
AS $$
DECLARE
  v_actor_party_id uuid;
  v_actor_status_code varchar(30);
  v_case delivery.service_cases%ROWTYPE;
  v_workflow delivery.service_case_workflow_versions%ROWTYPE;
  v_rule delivery.service_case_transition_rules%ROWTYPE;
  v_receipt_id uuid;
  v_existing_receipt delivery.service_case_command_receipts%ROWTYPE;
  v_attempt_id uuid;
  v_approval_request_id uuid;
  v_outbox_event_id uuid;
  v_request_hash char(64);
  v_role_passed boolean := false;
  v_gate_passed boolean := false;
  v_sod_passed boolean := true;
  v_rule_matched boolean := false;
  v_violation_reasons jsonb := '[]'::jsonb;
  v_evaluation_decision varchar(20);
  v_effective_enforcement_mode varchar(20);
  v_should_execute boolean := false;
  v_response jsonb;
  v_new_row_version bigint;
BEGIN
  IF p_request_payload IS NULL OR jsonb_typeof(p_request_payload) <> 'object' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'request_payload must be a JSON object';
  END IF;

  IF nullif(btrim(p_idempotency_key), '') IS NULL
     OR length(p_idempotency_key) > 160 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A valid idempotency key is required';
  END IF;

  SELECT a.party_id, a.status_code
    INTO v_actor_party_id, v_actor_status_code
  FROM iam.user_accounts a
  WHERE a.user_account_id = p_actor_user_account_id;

  IF v_actor_party_id IS NULL OR v_actor_status_code <> 'ACTIVE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'An active authenticated account is required';
  END IF;

  v_request_hash := encode(
    digest(
      concat_ws(
        ':',
        p_service_case_id::text,
        p_command_code,
        p_requested_to_stage_code,
        p_expected_row_version::text,
        coalesce(p_reason, ''),
        p_step_up_verified::text,
        p_request_payload::text
      ),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO delivery.service_case_command_receipts (
    service_case_id, idempotency_key, command_code, request_hash,
    actor_party_id, correlation_id
  )
  VALUES (
    p_service_case_id, p_idempotency_key, p_command_code, v_request_hash,
    v_actor_party_id, p_correlation_id
  )
  ON CONFLICT (service_case_id, idempotency_key) DO NOTHING
  RETURNING service_case_command_receipt_id INTO v_receipt_id;

  IF v_receipt_id IS NULL THEN
    SELECT *
      INTO v_existing_receipt
    FROM delivery.service_case_command_receipts
    WHERE service_case_id = p_service_case_id
      AND idempotency_key = p_idempotency_key;

    IF v_existing_receipt.request_hash <> v_request_hash THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Idempotency key was already used with a different request';
    END IF;

    RETURN coalesce(
      v_existing_receipt.response_snapshot,
      jsonb_build_object(
        'status', v_existing_receipt.command_status_code,
        'response_code', v_existing_receipt.response_code,
        'replayed', true
      )
    ) || jsonb_build_object('replayed', true);
  END IF;

  UPDATE delivery.service_case_command_receipts
  SET command_status_code = 'PROCESSING'
  WHERE service_case_command_receipt_id = v_receipt_id;

  SELECT *
    INTO v_case
  FROM delivery.service_cases
  WHERE service_case_id = p_service_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_response := jsonb_build_object(
      'status', 'REJECTED',
      'code', 'SERVICE_CASE_NOT_FOUND'
    );
    UPDATE delivery.service_case_command_receipts
    SET command_status_code = 'REJECTED',
        response_code = 'SERVICE_CASE_NOT_FOUND',
        response_snapshot = v_response,
        completed_at = clock_timestamp()
    WHERE service_case_command_receipt_id = v_receipt_id;
    RETURN v_response;
  END IF;

  IF v_case.row_version <> p_expected_row_version THEN
    v_response := jsonb_build_object(
      'status', 'REJECTED',
      'code', 'ROW_VERSION_CONFLICT',
      'expected_row_version', p_expected_row_version,
      'current_row_version', v_case.row_version
    );
    UPDATE delivery.service_case_command_receipts
    SET command_status_code = 'REJECTED',
        response_code = 'ROW_VERSION_CONFLICT',
        response_snapshot = v_response,
        completed_at = clock_timestamp()
    WHERE service_case_command_receipt_id = v_receipt_id;
    RETURN v_response;
  END IF;

  SELECT *
    INTO v_workflow
  FROM delivery.service_case_workflow_versions w
  WHERE w.workflow_code = 'SERVICE_CASE_STANDARD'
    AND w.status_code IN ('ACTIVE', 'APPROVED', 'DRAFT')
    AND (w.effective_from IS NULL OR w.effective_from <= clock_timestamp())
    AND (w.effective_to IS NULL OR w.effective_to > clock_timestamp())
  ORDER BY
    CASE w.status_code
      WHEN 'ACTIVE' THEN 1
      WHEN 'APPROVED' THEN 2
      ELSE 3
    END,
    w.version_no DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_response := jsonb_build_object(
      'status', 'REJECTED',
      'code', 'WORKFLOW_VERSION_NOT_FOUND'
    );
    UPDATE delivery.service_case_command_receipts
    SET command_status_code = 'REJECTED',
        response_code = 'WORKFLOW_VERSION_NOT_FOUND',
        response_snapshot = v_response,
        completed_at = clock_timestamp()
    WHERE service_case_command_receipt_id = v_receipt_id;
    RETURN v_response;
  END IF;

  v_effective_enforcement_mode :=
    delivery.resolve_service_case_enforcement_mode(
      v_workflow.service_case_workflow_version_id,
      p_service_case_id
    );

  SELECT *
    INTO v_rule
  FROM delivery.service_case_transition_rules r
  WHERE r.service_case_workflow_version_id =
        v_workflow.service_case_workflow_version_id
    AND r.from_stage_code = v_case.lifecycle_stage_code
    AND r.to_stage_code = p_requested_to_stage_code
    AND r.command_code = p_command_code
    AND r.is_active
  ORDER BY r.rule_priority
  LIMIT 1;

  v_rule_matched := FOUND;

  IF NOT v_rule_matched THEN
    v_violation_reasons := v_violation_reasons ||
      jsonb_build_array('TRANSITION_RULE_NOT_FOUND');
  ELSE
    v_sod_passed := CASE
      WHEN v_rule.approval_required THEN NULL
      ELSE true
    END;

    SELECT EXISTS (
      SELECT 1
      FROM governance.user_role_assignments a
      JOIN governance.roles gr ON gr.role_id = a.role_id
      JOIN delivery.service_case_transition_roles rr
        ON rr.role_code = gr.role_code
       AND rr.service_case_transition_rule_id =
           v_rule.service_case_transition_rule_id
      WHERE a.user_account_id = p_actor_user_account_id
        AND a.status_code = 'ACTIVE'
        AND a.valid_from <= clock_timestamp()
        AND (a.valid_to IS NULL OR a.valid_to > clock_timestamp())
    ) INTO v_role_passed;

    IF NOT v_role_passed THEN
      v_violation_reasons := v_violation_reasons ||
        jsonb_build_array('ACTOR_ROLE_NOT_ALLOWED');
    END IF;

    SELECT NOT EXISTS (
      SELECT 1
      FROM delivery.service_case_transition_gate_requirements g
      LEFT JOIN LATERAL (
        SELECT cg.decision_code
        FROM delivery.service_case_gates cg
        WHERE cg.service_case_id = p_service_case_id
          AND cg.gate_code = g.gate_code
        ORDER BY cg.gate_version DESC
        LIMIT 1
      ) current_gate ON true
      WHERE g.service_case_transition_rule_id =
            v_rule.service_case_transition_rule_id
        AND g.is_blocking
        AND NOT (
          current_gate.decision_code = 'PASSED'
          OR (
            g.required_decision_code = 'PASSED_OR_WAIVED'
            AND current_gate.decision_code = 'WAIVED'
          )
        )
    ) INTO v_gate_passed;

    IF NOT v_gate_passed THEN
      v_violation_reasons := v_violation_reasons ||
        jsonb_build_array('REQUIRED_GATE_NOT_SATISFIED');
    END IF;

    IF v_rule.reason_required AND nullif(btrim(p_reason), '') IS NULL THEN
      v_violation_reasons := v_violation_reasons ||
        jsonb_build_array('TRANSITION_REASON_REQUIRED');
    END IF;

    IF v_rule.step_up_auth_required AND NOT p_step_up_verified THEN
      v_violation_reasons := v_violation_reasons ||
        jsonb_build_array('STEP_UP_AUTH_REQUIRED');
    END IF;

    IF v_rule.approval_required THEN
      v_violation_reasons := v_violation_reasons ||
        jsonb_build_array('APPROVAL_REQUIRED');
    END IF;
  END IF;

  IF v_effective_enforcement_mode = 'DISABLED' THEN
    v_evaluation_decision := 'ALLOW';
    v_should_execute := true;
  ELSIF v_effective_enforcement_mode = 'MONITOR_ONLY' THEN
    v_evaluation_decision :=
      CASE
        WHEN jsonb_array_length(v_violation_reasons) = 0 THEN 'ALLOW'
        ELSE 'ALLOW_WITH_WARNING'
      END;
    v_should_execute := true;
  ELSIF jsonb_array_length(v_violation_reasons) > 0 THEN
    IF v_rule_matched
       AND v_rule.approval_required
       AND v_role_passed
       AND v_gate_passed
       AND (NOT v_rule.reason_required OR nullif(btrim(p_reason), '') IS NOT NULL)
       AND (NOT v_rule.step_up_auth_required OR p_step_up_verified) THEN
      v_evaluation_decision := 'REQUIRE_APPROVAL';
    ELSE
      v_evaluation_decision := 'BLOCK';
    END IF;
    v_should_execute := false;
  ELSE
    v_evaluation_decision := 'ALLOW';
    v_should_execute := true;
  END IF;

  INSERT INTO delivery.service_case_transition_attempts (
    service_case_id, service_case_workflow_version_id,
    service_case_transition_rule_id, service_case_command_receipt_id,
    actor_party_id, from_stage_code, requested_to_stage_code,
    enforcement_mode_code, evaluation_decision_code, rule_matched,
    role_check_passed, gate_check_passed, sod_check_passed,
    reasons, evaluation_snapshot, correlation_id
  )
  VALUES (
    p_service_case_id, v_workflow.service_case_workflow_version_id,
    CASE WHEN v_rule_matched THEN v_rule.service_case_transition_rule_id END,
    v_receipt_id, v_actor_party_id, v_case.lifecycle_stage_code,
    p_requested_to_stage_code, v_effective_enforcement_mode,
    v_evaluation_decision, v_rule_matched,
    CASE WHEN v_rule_matched THEN v_role_passed END,
    CASE WHEN v_rule_matched THEN v_gate_passed END,
    v_sod_passed, v_violation_reasons,
    jsonb_build_object(
      'case_row_version', v_case.row_version,
      'command_code', p_command_code,
      'step_up_verified', p_step_up_verified,
      'request_hash', v_request_hash
    ),
    p_correlation_id
  )
  RETURNING service_case_transition_attempt_id INTO v_attempt_id;

  IF v_evaluation_decision = 'REQUIRE_APPROVAL' THEN
    INSERT INTO governance.approval_requests (
      approval_code, request_type_code, resource_type, resource_id,
      requested_action_code, requested_by_party_id, request_reason,
      risk_level_code, minimum_approvals
    )
    VALUES (
      'SCA-' || replace(gen_random_uuid()::text, '-', ''),
      'SERVICE_CASE_TRANSITION', 'SERVICE_CASE', p_service_case_id,
      p_command_code, v_actor_party_id, coalesce(p_reason, p_command_code),
      CASE WHEN v_rule.step_up_auth_required THEN 'HIGH' ELSE 'NORMAL' END,
      v_rule.minimum_approvals
    )
    RETURNING approval_request_id INTO v_approval_request_id;

    INSERT INTO delivery.service_case_transition_approvals (
      service_case_transition_attempt_id, approval_request_id,
      approval_role_code, approval_order
    )
    VALUES (
      v_attempt_id, v_approval_request_id, 'WORKFLOW_APPROVER', 1
    );
  END IF;

  IF v_effective_enforcement_mode = 'MONITOR_ONLY'
     AND jsonb_array_length(v_violation_reasons) > 0 THEN
    INSERT INTO delivery.service_case_exceptions (
      service_case_id, exception_code, severity_code,
      entity_type, entity_id, description_ar
    )
    VALUES (
      p_service_case_id,
      'WORKFLOW_MONITOR_' || p_command_code,
      'WARNING',
      'TRANSITION_ATTEMPT',
      v_attempt_id,
      'رصد مشغل الأوامر مخالفة محتملة دون منع الانتقال لأن سير العمل في وضع المراقبة.'
    );
  END IF;

  IF v_should_execute THEN
    UPDATE delivery.service_cases
    SET
      lifecycle_stage_code = p_requested_to_stage_code,
      lifecycle_status_code = CASE
        WHEN p_requested_to_stage_code = 'CLOSED' THEN 'COMPLETED'
        WHEN p_requested_to_stage_code = 'CANCELLED' THEN 'CANCELLED'
        ELSE lifecycle_status_code
      END,
      completed_at = CASE
        WHEN p_requested_to_stage_code IN ('CLOSED', 'CANCELLED')
          THEN coalesce(completed_at, clock_timestamp())
        ELSE completed_at
      END,
      closed_at = CASE
        WHEN p_requested_to_stage_code = 'CLOSED'
          THEN coalesce(closed_at, clock_timestamp())
        ELSE closed_at
      END
    WHERE service_case_id = p_service_case_id
    RETURNING row_version INTO v_new_row_version;

    INSERT INTO delivery.service_case_stage_events (
      service_case_id, from_stage_code, to_stage_code, reason_code,
      comment, changed_by_party_id, is_automatic,
      source_event_table, source_event_id, correlation_id, occurred_at
    )
    VALUES (
      p_service_case_id, v_case.lifecycle_stage_code,
      p_requested_to_stage_code, p_command_code, p_reason,
      v_actor_party_id, false,
      'delivery.service_case_transition_attempts', v_attempt_id,
      p_correlation_id, clock_timestamp()
    );

    INSERT INTO integration.outbox_events (
      aggregate_type, aggregate_id, event_type, event_version,
      payload, headers, idempotency_key, correlation_id
    )
    VALUES (
      'SERVICE_CASE', p_service_case_id, 'SERVICE_CASE_STAGE_CHANGED', 1,
      jsonb_build_object(
        'service_case_id', p_service_case_id,
        'from_stage_code', v_case.lifecycle_stage_code,
        'to_stage_code', p_requested_to_stage_code,
        'command_code', p_command_code,
        'actor_party_id', v_actor_party_id,
        'row_version', v_new_row_version
      ),
      jsonb_build_object(
        'workflow_version_id', v_workflow.service_case_workflow_version_id,
        'transition_attempt_id', v_attempt_id
      ),
      'service-case:' || p_service_case_id::text || ':' || p_idempotency_key,
      p_correlation_id
    )
    RETURNING outbox_event_id INTO v_outbox_event_id;

    INSERT INTO delivery.service_case_transition_outbox_links (
      service_case_transition_attempt_id, outbox_event_id, event_role_code
    )
    VALUES (v_attempt_id, v_outbox_event_id, 'TRANSITION_RESULT');

    UPDATE delivery.service_case_transition_attempts
    SET executed_at = clock_timestamp()
    WHERE service_case_transition_attempt_id = v_attempt_id;
  ELSE
    v_new_row_version := v_case.row_version;
  END IF;

  v_response := jsonb_build_object(
    'status',
      CASE
        WHEN v_evaluation_decision = 'BLOCK' THEN 'REJECTED'
        WHEN v_evaluation_decision = 'REQUIRE_APPROVAL' THEN 'PENDING_APPROVAL'
        ELSE 'SUCCEEDED'
      END,
    'evaluation_decision', v_evaluation_decision,
    'executed', v_should_execute,
    'from_stage_code', v_case.lifecycle_stage_code,
    'to_stage_code', p_requested_to_stage_code,
    'row_version', v_new_row_version,
    'transition_attempt_id', v_attempt_id,
    'approval_request_id', v_approval_request_id,
    'reasons', v_violation_reasons,
    'replayed', false
  );

  UPDATE delivery.service_case_command_receipts
  SET
    command_status_code = CASE
      WHEN v_evaluation_decision = 'BLOCK' THEN 'REJECTED'
      ELSE 'SUCCEEDED'
    END,
    response_code = v_evaluation_decision,
    response_snapshot = v_response,
    completed_at = clock_timestamp()
  WHERE service_case_command_receipt_id = v_receipt_id;

  RETURN v_response;
END;
$$;


COMMENT ON FUNCTION delivery.execute_service_case_command(
  uuid, uuid, varchar, varchar, varchar, bigint, text, boolean, varchar, jsonb
) IS
  'V82 rollout-aware transactional command executor. Effective enforcement is resolved per service case; without an active plan it remains MONITOR_ONLY.';

CREATE VIEW delivery.v_service_case_enforcement_operations AS
SELECT
  a.service_case_transition_attempt_id,
  c.case_number,
  a.from_stage_code,
  a.requested_to_stage_code,
  a.enforcement_mode_code AS applied_enforcement_mode,
  a.evaluation_decision_code,
  a.rule_matched,
  a.role_check_passed,
  a.gate_check_passed,
  a.reasons,
  a.evaluated_at,
  a.executed_at,
  p.plan_code,
  p.rollout_status_code,
  p.current_percentage,
  p.emergency_stop_active
FROM delivery.service_case_transition_attempts a
JOIN delivery.service_cases c
  ON c.service_case_id = a.service_case_id
LEFT JOIN delivery.service_workflow_rollout_plans p
  ON p.service_case_workflow_version_id =
     a.service_case_workflow_version_id
 AND p.rollout_status_code IN ('CANARY_ACTIVE', 'FULL_ACTIVE', 'PAUSED');

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0300_v82_rollout_aware_command_executor')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;

