BEGIN;

-- Package L evaluates rollout windows. Promotion remains a human decision;
-- only a safety pause can be applied by this evaluator.

ALTER TABLE delivery.service_workflow_rollout_plans
  ADD COLUMN minimum_window_attempts integer NOT NULL DEFAULT 50
    CHECK (minimum_window_attempts BETWEEN 10 AND 100000);

ALTER TABLE delivery.service_workflow_rollout_windows
  ADD COLUMN recommendation_code varchar(24)
    CHECK (recommendation_code IN (
      'CONTINUE_MONITORING', 'PROMOTE_REVIEW',
      'PAUSE_REQUIRED', 'ROLLBACK_REVIEW'
    )),
  ADD COLUMN evaluated_by_party_id uuid
    REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  ADD COLUMN evaluated_at timestamptz;

CREATE TABLE delivery.service_workflow_rollout_recommendations (
  service_workflow_rollout_recommendation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_workflow_rollout_plan_id uuid NOT NULL
    REFERENCES delivery.service_workflow_rollout_plans(
      service_workflow_rollout_plan_id
    ) ON DELETE CASCADE,
  service_workflow_rollout_window_id uuid NOT NULL
    REFERENCES delivery.service_workflow_rollout_windows(
      service_workflow_rollout_window_id
    ) ON DELETE CASCADE,
  recommendation_code varchar(24) NOT NULL
    CHECK (recommendation_code IN (
      'CONTINUE_MONITORING', 'PROMOTE_REVIEW',
      'PAUSE_REQUIRED', 'ROLLBACK_REVIEW'
    )),
  is_binding boolean NOT NULL DEFAULT false,
  safety_pause_applied boolean NOT NULL DEFAULT false,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  metric_snapshot jsonb NOT NULL,
  threshold_snapshot jsonb NOT NULL,
  evaluated_by_party_id uuid NOT NULL
    REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  correlation_id varchar(120),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_rollout_recommendation_reasons_array
    CHECK (jsonb_typeof(reasons) = 'array'),
  CONSTRAINT ck_rollout_recommendation_metrics_object
    CHECK (jsonb_typeof(metric_snapshot) = 'object'),
  CONSTRAINT ck_rollout_recommendation_thresholds_object
    CHECK (jsonb_typeof(threshold_snapshot) = 'object')
);

CREATE INDEX ix_rollout_recommendations_plan_time
  ON delivery.service_workflow_rollout_recommendations(
    service_workflow_rollout_plan_id, created_at DESC
  );

CREATE OR REPLACE FUNCTION delivery.evaluate_service_workflow_rollout_window(
  p_service_workflow_rollout_plan_id uuid,
  p_evaluator_user_account_id uuid,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, integration, iam
AS $$
DECLARE
  v_evaluator_party_id uuid;
  v_plan delivery.service_workflow_rollout_plans%ROWTYPE;
  v_window delivery.service_workflow_rollout_windows%ROWTYPE;
  v_attempts integer := 0;
  v_blocks integer := 0;
  v_failures integer := 0;
  v_dead_letters integer := 0;
  v_p95 integer := 0;
  v_block_rate numeric(8,5) := 0;
  v_error_rate numeric(8,5) := 0;
  v_elapsed_hours numeric;
  v_recommendation varchar(24);
  v_reasons jsonb := '[]'::jsonb;
  v_safety_pause boolean := false;
  v_recommendation_id uuid;
  v_metrics jsonb;
  v_thresholds jsonb;
BEGIN
  SELECT a.party_id INTO v_evaluator_party_id
  FROM iam.user_accounts a
  WHERE a.user_account_id = p_evaluator_user_account_id
    AND a.status_code = 'ACTIVE';

  IF v_evaluator_party_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM governance.user_role_assignments ura
    JOIN governance.roles r ON r.role_id = ura.role_id
    WHERE ura.user_account_id = p_evaluator_user_account_id
      AND ura.status_code = 'ACTIVE'
      AND ura.valid_from <= clock_timestamp()
      AND (ura.valid_to IS NULL OR ura.valid_to > clock_timestamp())
      AND r.role_code IN ('PLATFORM_OPERATOR', 'PLATFORM_ADMIN')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Privileged platform evaluator role is required';
  END IF;

  SELECT * INTO v_plan
  FROM delivery.service_workflow_rollout_plans
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id
  FOR UPDATE;

  IF NOT FOUND OR v_plan.rollout_status_code NOT IN (
    'CANARY_ACTIVE', 'FULL_ACTIVE'
  ) THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'code', 'ACTIVE_ROLLOUT_REQUIRED'
    );
  END IF;

  SELECT * INTO v_window
  FROM delivery.service_workflow_rollout_windows
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id
    AND ended_at IS NULL
  ORDER BY window_no DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'code', 'OPEN_ROLLOUT_WINDOW_REQUIRED'
    );
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE a.evaluation_decision_code = 'BLOCK'
    )::integer,
    count(*) FILTER (
      WHERE r.command_status_code = 'FAILED'
    )::integer,
    coalesce(round(percentile_cont(0.95) WITHIN GROUP (
      ORDER BY extract(epoch FROM (r.completed_at - r.received_at)) * 1000
    ))::integer, 0)
  INTO v_attempts, v_blocks, v_failures, v_p95
  FROM delivery.service_case_transition_attempts a
  JOIN delivery.service_case_command_receipts r
    ON r.service_case_command_receipt_id =
       a.service_case_command_receipt_id
  WHERE a.service_case_workflow_version_id =
        v_plan.service_case_workflow_version_id
    AND a.enforcement_mode_code = 'ENFORCING'
    AND a.evaluated_at >= v_window.started_at
    AND a.evaluated_at < clock_timestamp();

  SELECT count(*)::integer INTO v_dead_letters
  FROM integration.outbox_dispatch_leases dl
  JOIN delivery.service_case_transition_outbox_links ol
    ON ol.outbox_event_id = dl.outbox_event_id
  JOIN delivery.service_case_transition_attempts a
    ON a.service_case_transition_attempt_id =
       ol.service_case_transition_attempt_id
  WHERE a.service_case_workflow_version_id =
        v_plan.service_case_workflow_version_id
    AND a.enforcement_mode_code = 'ENFORCING'
    AND a.evaluated_at >= v_window.started_at
    AND dl.lease_status_code = 'DEAD_LETTER';

  v_block_rate := CASE WHEN v_attempts = 0 THEN 0
    ELSE round(v_blocks::numeric / v_attempts, 5) END;
  v_error_rate := CASE WHEN v_attempts = 0 THEN 0
    ELSE round(v_failures::numeric / v_attempts, 5) END;
  v_elapsed_hours :=
    extract(epoch FROM (clock_timestamp() - v_window.started_at)) / 3600;

  IF v_block_rate > v_plan.maximum_block_rate THEN
    v_reasons := v_reasons ||
      jsonb_build_array('BLOCK_RATE_THRESHOLD_EXCEEDED');
  END IF;
  IF v_error_rate > v_plan.maximum_error_rate THEN
    v_reasons := v_reasons ||
      jsonb_build_array('ERROR_RATE_THRESHOLD_EXCEEDED');
  END IF;
  IF v_p95 > v_plan.maximum_p95_latency_ms THEN
    v_reasons := v_reasons ||
      jsonb_build_array('P95_LATENCY_THRESHOLD_EXCEEDED');
  END IF;
  IF v_dead_letters > 0 THEN
    v_reasons := v_reasons ||
      jsonb_build_array('DEAD_LETTER_DETECTED');
  END IF;

  IF jsonb_array_length(v_reasons) > 0 THEN
    v_recommendation := CASE
      WHEN v_dead_letters > 0 OR v_error_rate > v_plan.maximum_error_rate
        THEN 'ROLLBACK_REVIEW'
      ELSE 'PAUSE_REQUIRED'
    END;
    v_safety_pause := true;
  ELSIF v_attempts < v_plan.minimum_window_attempts
     OR v_elapsed_hours < v_plan.minimum_canary_hours THEN
    v_recommendation := 'CONTINUE_MONITORING';
    IF v_attempts < v_plan.minimum_window_attempts THEN
      v_reasons := v_reasons ||
        jsonb_build_array('MINIMUM_WINDOW_SAMPLE_NOT_REACHED');
    END IF;
    IF v_elapsed_hours < v_plan.minimum_canary_hours THEN
      v_reasons := v_reasons ||
        jsonb_build_array('MINIMUM_WINDOW_DURATION_NOT_REACHED');
    END IF;
  ELSE
    v_recommendation := 'PROMOTE_REVIEW';
  END IF;

  v_metrics := jsonb_build_object(
    'attempt_count', v_attempts,
    'blocked_attempt_count', v_blocks,
    'failed_command_count', v_failures,
    'dead_letter_count', v_dead_letters,
    'block_rate', v_block_rate,
    'error_rate', v_error_rate,
    'p95_latency_ms', v_p95,
    'elapsed_hours', round(v_elapsed_hours, 2)
  );
  v_thresholds := jsonb_build_object(
    'minimum_window_attempts', v_plan.minimum_window_attempts,
    'minimum_canary_hours', v_plan.minimum_canary_hours,
    'maximum_block_rate', v_plan.maximum_block_rate,
    'maximum_error_rate', v_plan.maximum_error_rate,
    'maximum_p95_latency_ms', v_plan.maximum_p95_latency_ms,
    'maximum_dead_letters', 0
  );

  UPDATE delivery.service_workflow_rollout_windows
  SET evaluated_attempt_count = v_attempts,
      blocked_attempt_count = v_blocks,
      failed_command_count = v_failures,
      p95_latency_ms = v_p95,
      block_rate = v_block_rate,
      error_rate = v_error_rate,
      metric_snapshot = v_metrics,
      recommendation_code = v_recommendation,
      evaluated_by_party_id = v_evaluator_party_id,
      evaluated_at = clock_timestamp(),
      outcome_code = CASE
        WHEN v_safety_pause THEN 'FAILED'
        WHEN v_recommendation = 'PROMOTE_REVIEW' THEN 'PASSED'
        ELSE 'RUNNING'
      END,
      ended_at = CASE
        WHEN v_safety_pause OR v_recommendation = 'PROMOTE_REVIEW'
          THEN clock_timestamp()
        ELSE ended_at
      END
  WHERE service_workflow_rollout_window_id =
        v_window.service_workflow_rollout_window_id;

  IF v_safety_pause THEN
    UPDATE delivery.service_workflow_rollout_plans
    SET rollout_status_code = 'PAUSED',
        current_percentage = 0,
        emergency_stop_active = true,
        paused_at = clock_timestamp(),
        rollback_reason =
          'AUTO_SAFETY_PAUSE: ' || v_reasons::text
    WHERE service_workflow_rollout_plan_id =
          p_service_workflow_rollout_plan_id;

    INSERT INTO delivery.service_workflow_rollout_events (
      service_workflow_rollout_plan_id, event_code,
      from_status_code, to_status_code, percentage,
      reason, actor_party_id, correlation_id, metadata
    )
    VALUES (
      p_service_workflow_rollout_plan_id, 'PAUSED',
      v_plan.rollout_status_code, 'PAUSED', 0,
      'إيقاف سلامة آلي نتيجة تجاوز حدود نافذة Canary.',
      v_evaluator_party_id, p_correlation_id,
      jsonb_build_object(
        'automatic', true,
        'reasons', v_reasons,
        'metrics', v_metrics
      )
    );
  END IF;

  INSERT INTO delivery.service_workflow_rollout_recommendations (
    service_workflow_rollout_plan_id,
    service_workflow_rollout_window_id,
    recommendation_code, is_binding, safety_pause_applied,
    reasons, metric_snapshot, threshold_snapshot,
    evaluated_by_party_id, correlation_id
  )
  VALUES (
    p_service_workflow_rollout_plan_id,
    v_window.service_workflow_rollout_window_id,
    v_recommendation, false, v_safety_pause,
    v_reasons, v_metrics, v_thresholds,
    v_evaluator_party_id, p_correlation_id
  )
  RETURNING service_workflow_rollout_recommendation_id
    INTO v_recommendation_id;

  RETURN jsonb_build_object(
    'status', 'SUCCEEDED',
    'recommendation_id', v_recommendation_id,
    'recommendation', v_recommendation,
    'is_binding', false,
    'safety_pause_applied', v_safety_pause,
    'reasons', v_reasons,
    'metrics', v_metrics,
    'thresholds', v_thresholds
  );
END;
$$;

CREATE VIEW delivery.v_service_workflow_rollout_latest_recommendation AS
SELECT DISTINCT ON (r.service_workflow_rollout_plan_id)
  r.service_workflow_rollout_plan_id,
  p.plan_code,
  p.rollout_status_code,
  p.current_percentage,
  r.recommendation_code,
  r.is_binding,
  r.safety_pause_applied,
  r.reasons,
  r.metric_snapshot,
  r.threshold_snapshot,
  r.created_at
FROM delivery.service_workflow_rollout_recommendations r
JOIN delivery.service_workflow_rollout_plans p
  ON p.service_workflow_rollout_plan_id =
     r.service_workflow_rollout_plan_id
ORDER BY r.service_workflow_rollout_plan_id, r.created_at DESC;

COMMENT ON FUNCTION delivery.evaluate_service_workflow_rollout_window(
  uuid, uuid, varchar
) IS
  'Evaluates a Canary window, emits a non-binding recommendation, and applies only a safety pause when hard thresholds are exceeded.';

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0310_v83_canary_metrics_recommendations')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
