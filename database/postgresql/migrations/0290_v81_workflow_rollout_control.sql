BEGIN;

-- Package J builds the governed rollout control plane. The command executor is
-- not switched by this migration; integration is intentionally deferred until
-- this control plane passes PostgreSQL integration and operational review.

CREATE TABLE delivery.service_workflow_rollout_plans (
  service_workflow_rollout_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_workflow_version_id uuid NOT NULL
    REFERENCES delivery.service_case_workflow_versions(
      service_case_workflow_version_id
    ) ON DELETE RESTRICT,
  readiness_assessment_id uuid NOT NULL
    REFERENCES delivery.service_workflow_readiness_assessments(
      service_workflow_readiness_assessment_id
    ) ON DELETE RESTRICT,
  plan_code varchar(80) NOT NULL UNIQUE,
  rollout_status_code varchar(24) NOT NULL DEFAULT 'DRAFT'
    CHECK (rollout_status_code IN (
      'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANARY_ACTIVE',
      'PAUSED', 'FULL_ACTIVE', 'ROLLED_BACK', 'COMPLETED', 'CANCELLED'
    )),
  canary_percentage numeric(5,2) NOT NULL DEFAULT 5
    CHECK (canary_percentage > 0 AND canary_percentage <= 25),
  current_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (current_percentage BETWEEN 0 AND 100),
  minimum_canary_hours integer NOT NULL DEFAULT 24
    CHECK (minimum_canary_hours BETWEEN 1 AND 720),
  maximum_block_rate numeric(8,5) NOT NULL DEFAULT 0.01
    CHECK (maximum_block_rate BETWEEN 0 AND 1),
  maximum_error_rate numeric(8,5) NOT NULL DEFAULT 0.005
    CHECK (maximum_error_rate BETWEEN 0 AND 1),
  maximum_p95_latency_ms integer NOT NULL DEFAULT 750
    CHECK (maximum_p95_latency_ms BETWEEN 50 AND 60000),
  approval_request_id uuid
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  emergency_stop_enabled boolean NOT NULL DEFAULT true,
  emergency_stop_active boolean NOT NULL DEFAULT false,
  requested_by_party_id uuid NOT NULL
    REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  rollback_reason text,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_workflow_rollout_approval
    CHECK (
      rollout_status_code IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED')
      OR (approval_request_id IS NOT NULL AND approved_at IS NOT NULL)
    ),
  CONSTRAINT ck_workflow_rollout_active_percentage
    CHECK (
      (rollout_status_code IN ('CANARY_ACTIVE', 'FULL_ACTIVE')
       AND current_percentage > 0)
      OR rollout_status_code NOT IN ('CANARY_ACTIVE', 'FULL_ACTIVE')
    )
);

CREATE UNIQUE INDEX uq_workflow_rollout_live_plan
  ON delivery.service_workflow_rollout_plans(
    service_case_workflow_version_id
  )
  WHERE rollout_status_code IN (
    'PENDING_APPROVAL', 'APPROVED', 'CANARY_ACTIVE', 'PAUSED', 'FULL_ACTIVE'
  );

CREATE TRIGGER trg_service_workflow_rollout_updated
BEFORE UPDATE ON delivery.service_workflow_rollout_plans
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE delivery.service_workflow_rollout_windows (
  service_workflow_rollout_window_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_workflow_rollout_plan_id uuid NOT NULL
    REFERENCES delivery.service_workflow_rollout_plans(
      service_workflow_rollout_plan_id
    ) ON DELETE CASCADE,
  window_no integer NOT NULL CHECK (window_no > 0),
  percentage numeric(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  evaluated_attempt_count integer NOT NULL DEFAULT 0
    CHECK (evaluated_attempt_count >= 0),
  blocked_attempt_count integer NOT NULL DEFAULT 0
    CHECK (blocked_attempt_count >= 0),
  failed_command_count integer NOT NULL DEFAULT 0
    CHECK (failed_command_count >= 0),
  p95_latency_ms integer CHECK (p95_latency_ms IS NULL OR p95_latency_ms >= 0),
  block_rate numeric(8,5) CHECK (block_rate IS NULL OR block_rate BETWEEN 0 AND 1),
  error_rate numeric(8,5) CHECK (error_rate IS NULL OR error_rate BETWEEN 0 AND 1),
  outcome_code varchar(20) NOT NULL DEFAULT 'RUNNING'
    CHECK (outcome_code IN ('RUNNING', 'PASSED', 'FAILED', 'STOPPED')),
  metric_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_rollout_window_period
    CHECK (ended_at IS NULL OR ended_at > started_at),
  CONSTRAINT ck_rollout_window_metrics_object
    CHECK (jsonb_typeof(metric_snapshot) = 'object'),
  UNIQUE (service_workflow_rollout_plan_id, window_no)
);

CREATE TABLE delivery.service_workflow_rollout_events (
  service_workflow_rollout_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_workflow_rollout_plan_id uuid NOT NULL
    REFERENCES delivery.service_workflow_rollout_plans(
      service_workflow_rollout_plan_id
    ) ON DELETE CASCADE,
  event_code varchar(40) NOT NULL
    CHECK (event_code IN (
      'REQUESTED', 'APPROVAL_LINKED', 'APPROVED', 'CANARY_STARTED',
      'PROMOTED', 'PAUSED', 'RESUMED', 'KILL_SWITCH_TRIGGERED',
      'ROLLED_BACK', 'FULL_ACTIVATED', 'COMPLETED', 'CANCELLED'
    )),
  from_status_code varchar(24),
  to_status_code varchar(24) NOT NULL,
  percentage numeric(5,2),
  reason text NOT NULL,
  actor_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  correlation_id varchar(120),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_rollout_event_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX ix_workflow_rollout_events_plan_time
  ON delivery.service_workflow_rollout_events(
    service_workflow_rollout_plan_id, occurred_at
  );

CREATE OR REPLACE FUNCTION delivery.create_service_workflow_rollout_plan(
  p_service_case_workflow_version_id uuid,
  p_readiness_assessment_id uuid,
  p_requester_user_account_id uuid,
  p_canary_percentage numeric DEFAULT 5,
  p_minimum_canary_hours integer DEFAULT 24,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, iam
AS $$
DECLARE
  v_requester_party_id uuid;
  v_assessment delivery.service_workflow_readiness_assessments%ROWTYPE;
  v_plan_id uuid;
  v_plan_code varchar(80);
  v_approval_id uuid;
BEGIN
  SELECT a.party_id INTO v_requester_party_id
  FROM iam.user_accounts a
  WHERE a.user_account_id = p_requester_user_account_id
    AND a.status_code = 'ACTIVE';

  IF v_requester_party_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM governance.user_role_assignments ura
    JOIN governance.roles r ON r.role_id = ura.role_id
    WHERE ura.user_account_id = p_requester_user_account_id
      AND ura.status_code = 'ACTIVE'
      AND ura.valid_from <= clock_timestamp()
      AND (ura.valid_to IS NULL OR ura.valid_to > clock_timestamp())
      AND r.role_code = 'PLATFORM_ADMIN'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Platform administrator role is required';
  END IF;

  SELECT * INTO v_assessment
  FROM delivery.service_workflow_readiness_assessments
  WHERE service_workflow_readiness_assessment_id = p_readiness_assessment_id
    AND service_case_workflow_version_id =
        p_service_case_workflow_version_id;

  IF NOT FOUND OR v_assessment.readiness_code <> 'READY_FOR_REVIEW' THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'code', 'READY_FOR_REVIEW_ASSESSMENT_REQUIRED'
    );
  END IF;
  IF v_assessment.assessed_at < clock_timestamp() - interval '7 days' THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'code', 'READINESS_ASSESSMENT_EXPIRED'
    );
  END IF;
  IF p_canary_percentage <= 0 OR p_canary_percentage > 25 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'canary_percentage must be greater than 0 and at most 25';
  END IF;

  v_plan_code := 'SWRP-' ||
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' ||
    left(replace(gen_random_uuid()::text, '-', ''), 8);

  INSERT INTO governance.approval_requests (
    approval_code, request_type_code, resource_type, resource_id,
    requested_action_code, requested_by_party_id, request_reason,
    risk_level_code, minimum_approvals, expires_at
  )
  VALUES (
    'SWRA-' || replace(gen_random_uuid()::text, '-', ''),
    'WORKFLOW_ENFORCEMENT_ROLLOUT', 'SERVICE_WORKFLOW_VERSION',
    p_service_case_workflow_version_id, 'START_ENFORCEMENT_CANARY',
    v_requester_party_id,
    'اعتماد بدء إنفاذ تدريجي لسير عمل قضية الخدمة.',
    'CRITICAL', 2, clock_timestamp() + interval '7 days'
  )
  RETURNING approval_request_id INTO v_approval_id;

  INSERT INTO delivery.service_workflow_rollout_plans (
    service_case_workflow_version_id, readiness_assessment_id,
    plan_code, rollout_status_code, canary_percentage,
    minimum_canary_hours, approval_request_id, requested_by_party_id
  )
  VALUES (
    p_service_case_workflow_version_id, p_readiness_assessment_id,
    v_plan_code, 'PENDING_APPROVAL', p_canary_percentage,
    p_minimum_canary_hours, v_approval_id, v_requester_party_id
  )
  RETURNING service_workflow_rollout_plan_id INTO v_plan_id;

  INSERT INTO delivery.service_workflow_rollout_events (
    service_workflow_rollout_plan_id, event_code, to_status_code,
    percentage, reason, actor_party_id, correlation_id,
    metadata
  )
  VALUES (
    v_plan_id, 'REQUESTED', 'PENDING_APPROVAL',
    p_canary_percentage, 'إنشاء خطة تفعيل تدريجي بانتظار اعتماد مزدوج.',
    v_requester_party_id, p_correlation_id,
    jsonb_build_object(
      'readiness_assessment_id', p_readiness_assessment_id,
      'approval_request_id', v_approval_id
    )
  );

  RETURN jsonb_build_object(
    'status', 'PENDING_APPROVAL',
    'plan_id', v_plan_id,
    'plan_code', v_plan_code,
    'approval_request_id', v_approval_id,
    'minimum_approvals', 2
  );
END;
$$;

CREATE OR REPLACE FUNCTION delivery.apply_service_workflow_rollout_action(
  p_service_workflow_rollout_plan_id uuid,
  p_actor_user_account_id uuid,
  p_action_code varchar,
  p_reason text,
  p_target_percentage numeric DEFAULT NULL,
  p_step_up_verified boolean DEFAULT false,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, iam
AS $$
DECLARE
  v_actor_party_id uuid;
  v_plan delivery.service_workflow_rollout_plans%ROWTYPE;
  v_approval_status varchar(20);
  v_new_status varchar(24);
  v_new_percentage numeric(5,2);
  v_event_code varchar(40);
  v_window_no integer;
BEGIN
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A reason is required';
  END IF;
  IF NOT p_step_up_verified THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Step-up authentication is required';
  END IF;

  SELECT a.party_id INTO v_actor_party_id
  FROM iam.user_accounts a
  WHERE a.user_account_id = p_actor_user_account_id
    AND a.status_code = 'ACTIVE';

  IF v_actor_party_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM governance.user_role_assignments ura
    JOIN governance.roles r ON r.role_id = ura.role_id
    WHERE ura.user_account_id = p_actor_user_account_id
      AND ura.status_code = 'ACTIVE'
      AND ura.valid_from <= clock_timestamp()
      AND (ura.valid_to IS NULL OR ura.valid_to > clock_timestamp())
      AND r.role_code = 'PLATFORM_ADMIN'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Platform administrator role is required';
  END IF;

  SELECT * INTO v_plan
  FROM delivery.service_workflow_rollout_plans
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'ROLLOUT_PLAN_NOT_FOUND');
  END IF;

  SELECT status_code INTO v_approval_status
  FROM governance.approval_requests
  WHERE approval_request_id = v_plan.approval_request_id;

  CASE p_action_code
    WHEN 'START_CANARY' THEN
      IF v_plan.rollout_status_code NOT IN ('PENDING_APPROVAL', 'APPROVED')
         OR v_approval_status <> 'APPROVED' THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'code', 'APPROVED_PLAN_REQUIRED');
      END IF;
      v_new_status := 'CANARY_ACTIVE';
      v_new_percentage := v_plan.canary_percentage;
      v_event_code := 'CANARY_STARTED';
    WHEN 'PROMOTE' THEN
      IF v_plan.rollout_status_code <> 'CANARY_ACTIVE' THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'code', 'ACTIVE_CANARY_REQUIRED');
      END IF;
      IF p_target_percentage IS NULL
         OR p_target_percentage <= v_plan.current_percentage
         OR p_target_percentage > 100 THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'code', 'INVALID_PROMOTION_PERCENTAGE');
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM delivery.service_workflow_rollout_windows w
        WHERE w.service_workflow_rollout_plan_id =
              p_service_workflow_rollout_plan_id
          AND w.outcome_code = 'PASSED'
          AND w.ended_at IS NOT NULL
          AND w.ended_at - w.started_at >=
              make_interval(hours => v_plan.minimum_canary_hours)
      ) THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'code', 'PASSED_CANARY_WINDOW_REQUIRED');
      END IF;
      v_new_status := CASE
        WHEN p_target_percentage = 100 THEN 'FULL_ACTIVE'
        ELSE 'CANARY_ACTIVE'
      END;
      v_new_percentage := p_target_percentage;
      v_event_code := CASE
        WHEN p_target_percentage = 100 THEN 'FULL_ACTIVATED'
        ELSE 'PROMOTED'
      END;
    WHEN 'PAUSE' THEN
      IF v_plan.rollout_status_code NOT IN ('CANARY_ACTIVE', 'FULL_ACTIVE') THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'code', 'ACTIVE_ROLLOUT_REQUIRED');
      END IF;
      v_new_status := 'PAUSED';
      v_new_percentage := 0;
      v_event_code := 'PAUSED';
    WHEN 'ROLLBACK' THEN
      IF v_plan.rollout_status_code NOT IN ('CANARY_ACTIVE', 'FULL_ACTIVE', 'PAUSED') THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'code', 'ROLLBACK_NOT_ALLOWED');
      END IF;
      v_new_status := 'ROLLED_BACK';
      v_new_percentage := 0;
      v_event_code := 'ROLLED_BACK';
    ELSE
      RETURN jsonb_build_object('status', 'REJECTED', 'code', 'UNSUPPORTED_ACTION');
  END CASE;

  UPDATE delivery.service_workflow_rollout_windows
  SET ended_at = coalesce(ended_at, clock_timestamp()),
      outcome_code = CASE
        WHEN outcome_code = 'RUNNING' THEN
          CASE WHEN p_action_code = 'PROMOTE' THEN 'PASSED' ELSE 'STOPPED' END
        ELSE outcome_code
      END
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id
    AND ended_at IS NULL;

  UPDATE delivery.service_workflow_rollout_plans
  SET rollout_status_code = v_new_status,
      current_percentage = v_new_percentage,
      approved_at = CASE
        WHEN p_action_code = 'START_CANARY' THEN
          coalesce(approved_at, clock_timestamp())
        ELSE approved_at
      END,
      started_at = CASE
        WHEN p_action_code = 'START_CANARY' THEN
          coalesce(started_at, clock_timestamp())
        ELSE started_at
      END,
      paused_at = CASE
        WHEN p_action_code = 'PAUSE' THEN clock_timestamp()
        ELSE paused_at
      END,
      rollback_reason = CASE
        WHEN p_action_code = 'ROLLBACK' THEN p_reason
        ELSE rollback_reason
      END,
      emergency_stop_active = CASE
        WHEN p_action_code = 'ROLLBACK' THEN true
        ELSE emergency_stop_active
      END
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id;

  IF v_new_status IN ('CANARY_ACTIVE', 'FULL_ACTIVE') THEN
    SELECT coalesce(max(window_no), 0) + 1 INTO v_window_no
    FROM delivery.service_workflow_rollout_windows
    WHERE service_workflow_rollout_plan_id =
          p_service_workflow_rollout_plan_id;

    INSERT INTO delivery.service_workflow_rollout_windows (
      service_workflow_rollout_plan_id, window_no,
      percentage, started_at
    )
    VALUES (
      p_service_workflow_rollout_plan_id, v_window_no,
      v_new_percentage, clock_timestamp()
    );
  END IF;

  INSERT INTO delivery.service_workflow_rollout_events (
    service_workflow_rollout_plan_id, event_code,
    from_status_code, to_status_code, percentage,
    reason, actor_party_id, correlation_id
  )
  VALUES (
    p_service_workflow_rollout_plan_id, v_event_code,
    v_plan.rollout_status_code, v_new_status, v_new_percentage,
    p_reason, v_actor_party_id, p_correlation_id
  );

  RETURN jsonb_build_object(
    'status', 'SUCCEEDED',
    'rollout_status', v_new_status,
    'current_percentage', v_new_percentage,
    'executor_integration', 'NOT_YET_ENABLED'
  );
END;
$$;

CREATE OR REPLACE FUNCTION delivery.trigger_service_workflow_kill_switch(
  p_service_workflow_rollout_plan_id uuid,
  p_actor_user_account_id uuid,
  p_reason text,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, iam
AS $$
DECLARE
  v_actor_party_id uuid;
  v_plan delivery.service_workflow_rollout_plans%ROWTYPE;
BEGIN
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Emergency reason is required';
  END IF;

  SELECT a.party_id INTO v_actor_party_id
  FROM iam.user_accounts a
  WHERE a.user_account_id = p_actor_user_account_id
    AND a.status_code = 'ACTIVE';

  IF v_actor_party_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM governance.user_role_assignments ura
    JOIN governance.roles r ON r.role_id = ura.role_id
    WHERE ura.user_account_id = p_actor_user_account_id
      AND ura.status_code = 'ACTIVE'
      AND r.role_code IN ('PLATFORM_ADMIN', 'PLATFORM_OPERATOR')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Privileged platform role is required';
  END IF;

  SELECT * INTO v_plan
  FROM delivery.service_workflow_rollout_plans
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_plan.emergency_stop_enabled THEN
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'KILL_SWITCH_UNAVAILABLE');
  END IF;

  UPDATE delivery.service_workflow_rollout_windows
  SET ended_at = coalesce(ended_at, clock_timestamp()),
      outcome_code = CASE WHEN outcome_code = 'RUNNING' THEN 'STOPPED' ELSE outcome_code END
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id
    AND ended_at IS NULL;

  UPDATE delivery.service_workflow_rollout_plans
  SET rollout_status_code = 'PAUSED',
      current_percentage = 0,
      emergency_stop_active = true,
      paused_at = clock_timestamp(),
      rollback_reason = p_reason
  WHERE service_workflow_rollout_plan_id =
        p_service_workflow_rollout_plan_id;

  INSERT INTO delivery.service_workflow_rollout_events (
    service_workflow_rollout_plan_id, event_code,
    from_status_code, to_status_code, percentage,
    reason, actor_party_id, correlation_id,
    metadata
  )
  VALUES (
    p_service_workflow_rollout_plan_id, 'KILL_SWITCH_TRIGGERED',
    v_plan.rollout_status_code, 'PAUSED', 0,
    p_reason, v_actor_party_id, p_correlation_id,
    jsonb_build_object('emergency', true)
  );

  RETURN jsonb_build_object(
    'status', 'SUCCEEDED',
    'rollout_status', 'PAUSED',
    'current_percentage', 0,
    'emergency_stop_active', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION delivery.resolve_service_case_enforcement_mode(
  p_service_case_workflow_version_id uuid,
  p_service_case_id uuid
)
RETURNS varchar
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery
AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN p.emergency_stop_active THEN 'MONITOR_ONLY'
      WHEN p.rollout_status_code NOT IN ('CANARY_ACTIVE', 'FULL_ACTIVE')
        THEN 'MONITOR_ONLY'
      WHEN (
        ('x' || substr(md5(p_service_case_id::text), 1, 8))::bit(32)::bigint
        % 10000
      ) < round(p.current_percentage * 100)
        THEN 'ENFORCING'
      ELSE 'MONITOR_ONLY'
    END
    FROM delivery.service_workflow_rollout_plans p
    WHERE p.service_case_workflow_version_id =
          p_service_case_workflow_version_id
      AND p.rollout_status_code IN ('CANARY_ACTIVE', 'FULL_ACTIVE')
    ORDER BY p.updated_at DESC
    LIMIT 1
  ), 'MONITOR_ONLY')
$$;

CREATE VIEW delivery.v_service_workflow_rollout_control AS
SELECT
  p.service_workflow_rollout_plan_id,
  p.plan_code,
  w.workflow_code,
  w.version_no,
  p.rollout_status_code,
  p.canary_percentage,
  p.current_percentage,
  p.emergency_stop_active,
  a.readiness_code,
  ar.status_code AS approval_status_code,
  p.requested_at,
  p.started_at,
  p.paused_at,
  p.updated_at
FROM delivery.service_workflow_rollout_plans p
JOIN delivery.service_case_workflow_versions w
  ON w.service_case_workflow_version_id =
     p.service_case_workflow_version_id
JOIN delivery.service_workflow_readiness_assessments a
  ON a.service_workflow_readiness_assessment_id =
     p.readiness_assessment_id
LEFT JOIN governance.approval_requests ar
  ON ar.approval_request_id = p.approval_request_id;

COMMENT ON FUNCTION delivery.resolve_service_case_enforcement_mode(uuid, uuid) IS
  'Deterministically resolves canary eligibility; Package J does not yet wire this resolver into the V78 executor.';

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0290_v81_workflow_rollout_control')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
