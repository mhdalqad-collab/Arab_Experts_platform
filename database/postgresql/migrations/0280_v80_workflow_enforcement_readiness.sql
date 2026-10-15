BEGIN;

-- Package I provides evidence-based readiness assessment. It does not activate
-- ENFORCING mode and cannot change a workflow version.

CREATE TABLE delivery.service_workflow_readiness_assessments (
  service_workflow_readiness_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_workflow_version_id uuid NOT NULL
    REFERENCES delivery.service_case_workflow_versions(
      service_case_workflow_version_id
    ) ON DELETE RESTRICT,
  assessment_code varchar(80) NOT NULL UNIQUE,
  window_started_at timestamptz NOT NULL,
  window_ended_at timestamptz NOT NULL,
  minimum_attempts_required integer NOT NULL CHECK (minimum_attempts_required > 0),
  transition_attempt_count integer NOT NULL CHECK (transition_attempt_count >= 0),
  warning_attempt_count integer NOT NULL CHECK (warning_attempt_count >= 0),
  blocked_candidate_count integer NOT NULL CHECK (blocked_candidate_count >= 0),
  role_violation_count integer NOT NULL CHECK (role_violation_count >= 0),
  gate_violation_count integer NOT NULL CHECK (gate_violation_count >= 0),
  stale_pending_approval_count integer NOT NULL CHECK (stale_pending_approval_count >= 0),
  unpublished_outbox_count integer NOT NULL CHECK (unpublished_outbox_count >= 0),
  dead_letter_count integer NOT NULL CHECK (dead_letter_count >= 0),
  warning_rate numeric(8,5) NOT NULL CHECK (warning_rate BETWEEN 0 AND 1),
  candidate_block_rate numeric(8,5) NOT NULL CHECK (candidate_block_rate BETWEEN 0 AND 1),
  threshold_snapshot jsonb NOT NULL,
  metric_snapshot jsonb NOT NULL,
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  readiness_code varchar(20) NOT NULL
    CHECK (readiness_code IN ('INSUFFICIENT_DATA', 'NOT_READY', 'READY_FOR_REVIEW')),
  assessed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_workflow_readiness_window
    CHECK (window_ended_at > window_started_at),
  CONSTRAINT ck_workflow_readiness_threshold_object
    CHECK (jsonb_typeof(threshold_snapshot) = 'object'),
  CONSTRAINT ck_workflow_readiness_metric_object
    CHECK (jsonb_typeof(metric_snapshot) = 'object'),
  CONSTRAINT ck_workflow_readiness_reasons_array
    CHECK (jsonb_typeof(blocking_reasons) = 'array')
);

CREATE INDEX ix_workflow_readiness_version_time
  ON delivery.service_workflow_readiness_assessments(
    service_case_workflow_version_id, assessed_at DESC
  );

CREATE OR REPLACE FUNCTION delivery.assess_service_workflow_readiness(
  p_service_case_workflow_version_id uuid,
  p_window_days integer DEFAULT 30,
  p_minimum_attempts integer DEFAULT 100,
  p_max_warning_rate numeric DEFAULT 0.02,
  p_max_candidate_block_rate numeric DEFAULT 0.01,
  p_max_stale_approvals integer DEFAULT 0,
  p_max_unpublished_outbox integer DEFAULT 0,
  p_max_dead_letters integer DEFAULT 0,
  p_assessed_by_party_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, delivery, governance, integration
AS $$
DECLARE
  v_workflow delivery.service_case_workflow_versions%ROWTYPE;
  v_window_start timestamptz;
  v_attempts integer;
  v_warnings integer;
  v_block_candidates integer;
  v_role_violations integer;
  v_gate_violations integer;
  v_stale_approvals integer;
  v_unpublished integer;
  v_dead_letters integer;
  v_warning_rate numeric(8,5);
  v_block_rate numeric(8,5);
  v_reasons jsonb := '[]'::jsonb;
  v_readiness varchar(20);
  v_assessment_id uuid;
  v_code varchar(80);
BEGIN
  IF p_window_days NOT BETWEEN 7 AND 180 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'window_days must be between 7 and 180';
  END IF;
  IF p_minimum_attempts NOT BETWEEN 10 AND 1000000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'minimum_attempts must be between 10 and 1000000';
  END IF;
  IF p_max_warning_rate NOT BETWEEN 0 AND 1
     OR p_max_candidate_block_rate NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'rate thresholds must be between 0 and 1';
  END IF;

  SELECT * INTO v_workflow
  FROM delivery.service_case_workflow_versions
  WHERE service_case_workflow_version_id = p_service_case_workflow_version_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'REJECTED', 'code', 'WORKFLOW_VERSION_NOT_FOUND');
  END IF;

  v_window_start := clock_timestamp() - make_interval(days => p_window_days);

  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE evaluation_decision_code = 'ALLOW_WITH_WARNING'
    )::integer,
    count(*) FILTER (
      WHERE jsonb_array_length(reasons) > 0
    )::integer,
    count(*) FILTER (
      WHERE reasons ? 'ACTOR_ROLE_NOT_ALLOWED'
    )::integer,
    count(*) FILTER (
      WHERE reasons ? 'REQUIRED_GATE_NOT_SATISFIED'
    )::integer
  INTO
    v_attempts, v_warnings, v_block_candidates,
    v_role_violations, v_gate_violations
  FROM delivery.service_case_transition_attempts
  WHERE service_case_workflow_version_id = p_service_case_workflow_version_id
    AND evaluated_at >= v_window_start;

  SELECT count(*)::integer INTO v_stale_approvals
  FROM governance.approval_requests ar
  JOIN delivery.service_case_transition_approvals l
    ON l.approval_request_id = ar.approval_request_id
  JOIN delivery.service_case_transition_attempts a
    ON a.service_case_transition_attempt_id =
       l.service_case_transition_attempt_id
  WHERE a.service_case_workflow_version_id = p_service_case_workflow_version_id
    AND ar.status_code IN ('PENDING', 'PARTIALLY_APPROVED')
    AND ar.created_at < clock_timestamp() - interval '24 hours';

  SELECT count(*)::integer INTO v_unpublished
  FROM integration.outbox_events e
  JOIN delivery.service_case_transition_outbox_links l
    ON l.outbox_event_id = e.outbox_event_id
  JOIN delivery.service_case_transition_attempts a
    ON a.service_case_transition_attempt_id =
       l.service_case_transition_attempt_id
  WHERE a.service_case_workflow_version_id = p_service_case_workflow_version_id
    AND e.published_at IS NULL
    AND e.available_at < clock_timestamp() - interval '15 minutes';

  SELECT count(*)::integer INTO v_dead_letters
  FROM integration.outbox_dispatch_leases dl
  JOIN delivery.service_case_transition_outbox_links l
    ON l.outbox_event_id = dl.outbox_event_id
  JOIN delivery.service_case_transition_attempts a
    ON a.service_case_transition_attempt_id =
       l.service_case_transition_attempt_id
  WHERE a.service_case_workflow_version_id = p_service_case_workflow_version_id
    AND dl.lease_status_code = 'DEAD_LETTER'
    AND dl.claimed_at >= v_window_start;

  v_warning_rate := CASE WHEN v_attempts = 0 THEN 0
    ELSE round(v_warnings::numeric / v_attempts, 5) END;
  v_block_rate := CASE WHEN v_attempts = 0 THEN 0
    ELSE round(v_block_candidates::numeric / v_attempts, 5) END;

  IF v_attempts < p_minimum_attempts THEN
    v_reasons := v_reasons || jsonb_build_array('MINIMUM_SAMPLE_NOT_REACHED');
  END IF;
  IF v_warning_rate > p_max_warning_rate THEN
    v_reasons := v_reasons || jsonb_build_array('WARNING_RATE_ABOVE_THRESHOLD');
  END IF;
  IF v_block_rate > p_max_candidate_block_rate THEN
    v_reasons := v_reasons || jsonb_build_array('CANDIDATE_BLOCK_RATE_ABOVE_THRESHOLD');
  END IF;
  IF v_stale_approvals > p_max_stale_approvals THEN
    v_reasons := v_reasons || jsonb_build_array('STALE_APPROVALS_PRESENT');
  END IF;
  IF v_unpublished > p_max_unpublished_outbox THEN
    v_reasons := v_reasons || jsonb_build_array('STALE_OUTBOX_EVENTS_PRESENT');
  END IF;
  IF v_dead_letters > p_max_dead_letters THEN
    v_reasons := v_reasons || jsonb_build_array('DEAD_LETTERS_PRESENT');
  END IF;

  v_readiness := CASE
    WHEN v_attempts < p_minimum_attempts THEN 'INSUFFICIENT_DATA'
    WHEN jsonb_array_length(v_reasons) > 0 THEN 'NOT_READY'
    ELSE 'READY_FOR_REVIEW'
  END;
  v_code := 'SWR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
    '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  INSERT INTO delivery.service_workflow_readiness_assessments (
    service_case_workflow_version_id, assessment_code,
    window_started_at, window_ended_at, minimum_attempts_required,
    transition_attempt_count, warning_attempt_count, blocked_candidate_count,
    role_violation_count, gate_violation_count,
    stale_pending_approval_count, unpublished_outbox_count, dead_letter_count,
    warning_rate, candidate_block_rate, threshold_snapshot, metric_snapshot,
    blocking_reasons, readiness_code, assessed_by_party_id
  )
  VALUES (
    p_service_case_workflow_version_id, v_code,
    v_window_start, clock_timestamp(), p_minimum_attempts,
    v_attempts, v_warnings, v_block_candidates,
    v_role_violations, v_gate_violations,
    v_stale_approvals, v_unpublished, v_dead_letters,
    v_warning_rate, v_block_rate,
    jsonb_build_object(
      'window_days', p_window_days,
      'minimum_attempts', p_minimum_attempts,
      'max_warning_rate', p_max_warning_rate,
      'max_candidate_block_rate', p_max_candidate_block_rate,
      'max_stale_approvals', p_max_stale_approvals,
      'max_unpublished_outbox', p_max_unpublished_outbox,
      'max_dead_letters', p_max_dead_letters
    ),
    jsonb_build_object(
      'attempts', v_attempts,
      'warnings', v_warnings,
      'candidate_blocks', v_block_candidates,
      'role_violations', v_role_violations,
      'gate_violations', v_gate_violations,
      'stale_approvals', v_stale_approvals,
      'unpublished_outbox', v_unpublished,
      'dead_letters', v_dead_letters
    ),
    v_reasons, v_readiness, p_assessed_by_party_id
  )
  RETURNING service_workflow_readiness_assessment_id INTO v_assessment_id;

  RETURN jsonb_build_object(
    'status', 'SUCCEEDED',
    'assessment_id', v_assessment_id,
    'assessment_code', v_code,
    'readiness', v_readiness,
    'blocking_reasons', v_reasons,
    'attempt_count', v_attempts,
    'warning_rate', v_warning_rate,
    'candidate_block_rate', v_block_rate
  );
END;
$$;

CREATE VIEW delivery.v_service_workflow_latest_readiness AS
SELECT DISTINCT ON (a.service_case_workflow_version_id)
  a.service_case_workflow_version_id,
  w.workflow_code,
  w.version_no,
  w.enforcement_mode_code,
  w.status_code AS workflow_status_code,
  a.assessment_code,
  a.readiness_code,
  a.transition_attempt_count,
  a.warning_rate,
  a.candidate_block_rate,
  a.stale_pending_approval_count,
  a.unpublished_outbox_count,
  a.dead_letter_count,
  a.blocking_reasons,
  a.assessed_at
FROM delivery.service_workflow_readiness_assessments a
JOIN delivery.service_case_workflow_versions w
  ON w.service_case_workflow_version_id =
     a.service_case_workflow_version_id
ORDER BY a.service_case_workflow_version_id, a.assessed_at DESC;

COMMENT ON FUNCTION delivery.assess_service_workflow_readiness(
  uuid, integer, integer, numeric, numeric, integer, integer, integer, uuid
) IS
  'Creates an immutable evidence snapshot for human review; it never activates ENFORCING mode.';

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0280_v80_workflow_enforcement_readiness')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
