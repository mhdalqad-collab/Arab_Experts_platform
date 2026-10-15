BEGIN;

-- Package F governs service-case transitions. The initial workflow version is
-- MONITOR_ONLY: violations are recorded and surfaced, but existing operations
-- are not blocked until an approved enforcing version is activated.

CREATE TABLE delivery.service_case_workflow_versions (
  service_case_workflow_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_code varchar(60) NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  name_ar varchar(240) NOT NULL,
  enforcement_mode_code varchar(20) NOT NULL DEFAULT 'MONITOR_ONLY'
    CHECK (enforcement_mode_code IN ('DISABLED', 'MONITOR_ONLY', 'ENFORCING')),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED')),
  definition_hash char(64),
  effective_from timestamptz,
  effective_to timestamptz,
  approved_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_service_case_workflow_period
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  CONSTRAINT ck_service_case_workflow_approval
    CHECK (
      status_code = 'DRAFT'
      OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL)
    ),
  UNIQUE (workflow_code, version_no)
);

CREATE UNIQUE INDEX uq_active_service_case_workflow
  ON delivery.service_case_workflow_versions(workflow_code)
  WHERE status_code = 'ACTIVE';

CREATE TABLE delivery.service_case_transition_rules (
  service_case_transition_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_workflow_version_id uuid NOT NULL
    REFERENCES delivery.service_case_workflow_versions(
      service_case_workflow_version_id
    ) ON DELETE CASCADE,
  rule_code varchar(80) NOT NULL,
  from_stage_code varchar(30) NOT NULL,
  to_stage_code varchar(30) NOT NULL,
  command_code varchar(80) NOT NULL,
  reason_required boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT false,
  minimum_approvals smallint NOT NULL DEFAULT 0 CHECK (minimum_approvals >= 0),
  step_up_auth_required boolean NOT NULL DEFAULT false,
  terminal_transition boolean NOT NULL DEFAULT false,
  rule_priority integer NOT NULL DEFAULT 100 CHECK (rule_priority > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_service_case_transition_distinct
    CHECK (from_stage_code <> to_stage_code),
  CONSTRAINT ck_service_case_transition_approval_count
    CHECK (
      (approval_required AND minimum_approvals > 0)
      OR (NOT approval_required AND minimum_approvals = 0)
    ),
  UNIQUE (service_case_workflow_version_id, rule_code),
  UNIQUE (
    service_case_workflow_version_id,
    from_stage_code, to_stage_code, command_code
  )
);

CREATE INDEX ix_service_case_transition_lookup
  ON delivery.service_case_transition_rules(
    service_case_workflow_version_id, from_stage_code, to_stage_code
  ) WHERE is_active;

CREATE TABLE delivery.service_case_transition_roles (
  service_case_transition_role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_transition_rule_id uuid NOT NULL
    REFERENCES delivery.service_case_transition_rules(
      service_case_transition_rule_id
    ) ON DELETE CASCADE,
  role_code varchar(60) NOT NULL
    REFERENCES governance.roles(role_code) ON DELETE RESTRICT,
  role_requirement_code varchar(20) NOT NULL DEFAULT 'ANY'
    CHECK (role_requirement_code IN ('ANY', 'REQUESTER', 'APPROVER', 'OBSERVER')),
  organization_scope_required boolean NOT NULL DEFAULT false,
  UNIQUE (service_case_transition_rule_id, role_code, role_requirement_code)
);

CREATE TABLE delivery.service_case_transition_gate_requirements (
  service_case_transition_gate_requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_transition_rule_id uuid NOT NULL
    REFERENCES delivery.service_case_transition_rules(
      service_case_transition_rule_id
    ) ON DELETE CASCADE,
  gate_code varchar(60) NOT NULL,
  required_decision_code varchar(20) NOT NULL DEFAULT 'PASSED'
    CHECK (required_decision_code IN ('PASSED', 'PASSED_OR_WAIVED')),
  is_blocking boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (service_case_transition_rule_id, gate_code),
  UNIQUE (service_case_transition_rule_id, display_order)
);

CREATE TABLE delivery.service_case_command_receipts (
  service_case_command_receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_id uuid NOT NULL
    REFERENCES delivery.service_cases(service_case_id) ON DELETE RESTRICT,
  idempotency_key varchar(160) NOT NULL,
  command_code varchar(80) NOT NULL,
  request_hash char(64) NOT NULL,
  actor_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  command_status_code varchar(20) NOT NULL DEFAULT 'RECEIVED'
    CHECK (command_status_code IN (
      'RECEIVED', 'PROCESSING', 'SUCCEEDED', 'REJECTED', 'FAILED'
    )),
  response_code varchar(60),
  response_snapshot jsonb,
  correlation_id varchar(120),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT ck_service_case_command_completion
    CHECK (
      command_status_code IN ('RECEIVED', 'PROCESSING')
      OR completed_at IS NOT NULL
    ),
  CONSTRAINT ck_service_case_command_response_object
    CHECK (
      response_snapshot IS NULL
      OR jsonb_typeof(response_snapshot) = 'object'
    ),
  UNIQUE (service_case_id, idempotency_key)
);

CREATE INDEX ix_service_case_commands_actor_time
  ON delivery.service_case_command_receipts(actor_party_id, received_at DESC);

CREATE TABLE delivery.service_case_transition_attempts (
  service_case_transition_attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_id uuid NOT NULL
    REFERENCES delivery.service_cases(service_case_id) ON DELETE RESTRICT,
  service_case_workflow_version_id uuid NOT NULL
    REFERENCES delivery.service_case_workflow_versions(
      service_case_workflow_version_id
    ) ON DELETE RESTRICT,
  service_case_transition_rule_id uuid
    REFERENCES delivery.service_case_transition_rules(
      service_case_transition_rule_id
    ) ON DELETE RESTRICT,
  service_case_command_receipt_id uuid
    REFERENCES delivery.service_case_command_receipts(
      service_case_command_receipt_id
    ) ON DELETE RESTRICT,
  actor_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  from_stage_code varchar(30) NOT NULL,
  requested_to_stage_code varchar(30) NOT NULL,
  enforcement_mode_code varchar(20) NOT NULL
    CHECK (enforcement_mode_code IN ('DISABLED', 'MONITOR_ONLY', 'ENFORCING')),
  evaluation_decision_code varchar(20) NOT NULL
    CHECK (evaluation_decision_code IN (
      'ALLOW', 'ALLOW_WITH_WARNING', 'REQUIRE_APPROVAL', 'BLOCK'
    )),
  rule_matched boolean NOT NULL DEFAULT false,
  role_check_passed boolean,
  gate_check_passed boolean,
  sod_check_passed boolean,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id varchar(120),
  evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  executed_at timestamptz,
  CONSTRAINT ck_service_case_attempt_stages
    CHECK (from_stage_code <> requested_to_stage_code),
  CONSTRAINT ck_service_case_attempt_reasons_array
    CHECK (jsonb_typeof(reasons) = 'array'),
  CONSTRAINT ck_service_case_attempt_snapshot_object
    CHECK (jsonb_typeof(evaluation_snapshot) = 'object'),
  CONSTRAINT ck_service_case_attempt_monitor_nonblocking
    CHECK (
      enforcement_mode_code <> 'MONITOR_ONLY'
      OR evaluation_decision_code <> 'BLOCK'
    )
);

CREATE INDEX ix_service_case_attempts_case_time
  ON delivery.service_case_transition_attempts(service_case_id, evaluated_at DESC);

CREATE TABLE delivery.service_case_transition_approvals (
  service_case_transition_approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_transition_attempt_id uuid NOT NULL
    REFERENCES delivery.service_case_transition_attempts(
      service_case_transition_attempt_id
    ) ON DELETE CASCADE,
  approval_request_id uuid NOT NULL
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  approval_role_code varchar(60) NOT NULL,
  approval_order smallint NOT NULL DEFAULT 1 CHECK (approval_order > 0),
  UNIQUE (service_case_transition_attempt_id, approval_request_id),
  UNIQUE (service_case_transition_attempt_id, approval_order)
);

CREATE TABLE delivery.service_case_transition_outbox_links (
  service_case_transition_outbox_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_transition_attempt_id uuid NOT NULL
    REFERENCES delivery.service_case_transition_attempts(
      service_case_transition_attempt_id
    ) ON DELETE CASCADE,
  outbox_event_id uuid NOT NULL UNIQUE
    REFERENCES integration.outbox_events(outbox_event_id) ON DELETE RESTRICT,
  event_role_code varchar(30) NOT NULL DEFAULT 'TRANSITION_RESULT'
    CHECK (event_role_code IN (
      'TRANSITION_REQUESTED', 'TRANSITION_RESULT',
      'APPROVAL_REQUIRED', 'VIOLATION_DETECTED'
    )),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (service_case_transition_attempt_id, event_role_code)
);

-- The workflow is inserted in MONITOR_ONLY/DRAFT mode. It cannot become active
-- or enforcing without an explicit human approval in a later controlled step.
INSERT INTO delivery.service_case_workflow_versions (
  workflow_code, version_no, name_ar, enforcement_mode_code, status_code
)
VALUES (
  'SERVICE_CASE_STANDARD', 1,
  'دورة طلب الخدمة القياسية — وضع المراقبة',
  'MONITOR_ONLY', 'DRAFT'
);

WITH workflow AS (
  SELECT service_case_workflow_version_id
  FROM delivery.service_case_workflow_versions
  WHERE workflow_code = 'SERVICE_CASE_STANDARD' AND version_no = 1
)
INSERT INTO delivery.service_case_transition_rules (
  service_case_workflow_version_id, rule_code, from_stage_code, to_stage_code,
  command_code, reason_required, approval_required, minimum_approvals,
  step_up_auth_required, terminal_transition, rule_priority
)
SELECT workflow.service_case_workflow_version_id, rules.*
FROM workflow
CROSS JOIN (
  VALUES
    ('SUBMIT_REQUEST', 'REQUEST', 'QUALIFICATION', 'SUBMIT_REQUEST', false, false, 0, false, false, 10),
    ('APPROVE_FOR_MATCHING', 'QUALIFICATION', 'MATCHING', 'APPROVE_FOR_MATCHING', true, true, 1, true, false, 20),
    ('PUBLISH_COMPARISON', 'MATCHING', 'COMPARISON', 'PUBLISH_COMPARISON', false, false, 0, false, false, 30),
    ('OPEN_PROPOSALS', 'COMPARISON', 'PROPOSAL', 'OPEN_PROPOSALS', false, false, 0, false, false, 40),
    ('SELECT_PROVIDER', 'PROPOSAL', 'SELECTION', 'SELECT_PROVIDER', true, false, 0, true, false, 50),
    ('START_CONTRACTING', 'SELECTION', 'CONTRACTING', 'START_CONTRACTING', false, false, 0, false, false, 60),
    ('ACTIVATE_DELIVERY', 'CONTRACTING', 'DELIVERY', 'ACTIVATE_DELIVERY', true, true, 2, true, false, 70),
    ('SUBMIT_FOR_ACCEPTANCE', 'DELIVERY', 'ACCEPTANCE', 'SUBMIT_FOR_ACCEPTANCE', false, false, 0, false, false, 80),
    ('START_CLOSURE', 'ACCEPTANCE', 'CLOSURE', 'START_CLOSURE', true, true, 1, true, false, 90),
    ('CLOSE_CASE', 'CLOSURE', 'CLOSED', 'CLOSE_CASE', true, true, 1, true, true, 100),
    ('CANCEL_BEFORE_CONTRACT', 'REQUEST', 'CANCELLED', 'CANCEL_CASE', true, false, 0, true, true, 110),
    ('CANCEL_QUALIFICATION', 'QUALIFICATION', 'CANCELLED', 'CANCEL_CASE', true, false, 0, true, true, 111),
    ('CANCEL_MATCHING', 'MATCHING', 'CANCELLED', 'CANCEL_CASE', true, false, 0, true, true, 112),
    ('CANCEL_COMPARISON', 'COMPARISON', 'CANCELLED', 'CANCEL_CASE', true, false, 0, true, true, 113),
    ('CANCEL_PROPOSAL', 'PROPOSAL', 'CANCELLED', 'CANCEL_CASE', true, false, 0, true, true, 114)
) rules(
  rule_code, from_stage_code, to_stage_code, command_code,
  reason_required, approval_required, minimum_approvals,
  step_up_auth_required, terminal_transition, rule_priority
);

-- Transition rules are part of the migration chain and must not depend on
-- reference seeds being applied first. The governance seed remains idempotent.
INSERT INTO governance.roles (
  role_code, name_ar, name_en, role_scope_code,
  is_system_role, is_privileged, description_ar
)
VALUES
  ('CLIENT_MEMBER', 'عميل', 'Client member', 'MEMBER', true, false,
   'إدارة الاحتياجات وطلبات الخدمة والمقارنة والتعاقد.'),
  ('PROFESSIONAL_MEMBER', 'عضو مهني', 'Professional member', 'MEMBER', true, false,
   'خبير أو مدرب أو مستشار أو باحث يدير عروضه المهنية.'),
  ('FINANCE_OPERATOR', 'مشغل مالي', 'Finance operator', 'PLATFORM', true, true,
   'تشغيل الفواتير والمدفوعات والاسترداد دون إدارة الصلاحيات.'),
  ('PLATFORM_OPERATOR', 'مشغل المنصة', 'Platform operator', 'PLATFORM', true, true,
   'تشغيل الطلبات والجودة والدعم ضمن صلاحيات محددة.')
ON CONFLICT (role_code) DO NOTHING;

WITH transition_roles(rule_code, role_code, requirement_code) AS (
  VALUES
    ('SUBMIT_REQUEST', 'CLIENT_MEMBER', 'REQUESTER'),
    ('APPROVE_FOR_MATCHING', 'PLATFORM_OPERATOR', 'APPROVER'),
    ('PUBLISH_COMPARISON', 'PLATFORM_OPERATOR', 'REQUESTER'),
    ('OPEN_PROPOSALS', 'CLIENT_MEMBER', 'REQUESTER'),
    ('SELECT_PROVIDER', 'CLIENT_MEMBER', 'REQUESTER'),
    ('START_CONTRACTING', 'CLIENT_MEMBER', 'REQUESTER'),
    ('ACTIVATE_DELIVERY', 'PLATFORM_OPERATOR', 'APPROVER'),
    ('ACTIVATE_DELIVERY', 'FINANCE_OPERATOR', 'APPROVER'),
    ('SUBMIT_FOR_ACCEPTANCE', 'PROFESSIONAL_MEMBER', 'REQUESTER'),
    ('START_CLOSURE', 'CLIENT_MEMBER', 'APPROVER'),
    ('CLOSE_CASE', 'PLATFORM_OPERATOR', 'APPROVER'),
    ('CANCEL_BEFORE_CONTRACT', 'CLIENT_MEMBER', 'REQUESTER'),
    ('CANCEL_QUALIFICATION', 'CLIENT_MEMBER', 'REQUESTER'),
    ('CANCEL_MATCHING', 'CLIENT_MEMBER', 'REQUESTER'),
    ('CANCEL_COMPARISON', 'CLIENT_MEMBER', 'REQUESTER'),
    ('CANCEL_PROPOSAL', 'CLIENT_MEMBER', 'REQUESTER')
)
INSERT INTO delivery.service_case_transition_roles (
  service_case_transition_rule_id, role_code, role_requirement_code
)
SELECT r.service_case_transition_rule_id, x.role_code, x.requirement_code
FROM transition_roles x
JOIN delivery.service_case_transition_rules r ON r.rule_code = x.rule_code
JOIN delivery.service_case_workflow_versions w
  ON w.service_case_workflow_version_id = r.service_case_workflow_version_id
WHERE w.workflow_code = 'SERVICE_CASE_STANDARD' AND w.version_no = 1;

WITH gate_requirements(rule_code, gate_code, decision_code, display_order) AS (
  VALUES
    ('SUBMIT_REQUEST', 'NEED_COMPLETENESS', 'PASSED', 1),
    ('APPROVE_FOR_MATCHING', 'REQUEST_QUALIFICATION', 'PASSED', 1),
    ('PUBLISH_COMPARISON', 'MATCHING_RUN_COMPLETED', 'PASSED', 1),
    ('SELECT_PROVIDER', 'CLIENT_SELECTION_RECORDED', 'PASSED', 1),
    ('START_CONTRACTING', 'PROPOSAL_ACCEPTED', 'PASSED', 1),
    ('ACTIVATE_DELIVERY', 'CONTRACT_SIGNATURES_COMPLETE', 'PASSED', 1),
    ('ACTIVATE_DELIVERY', 'DELIVERY_READINESS', 'PASSED_OR_WAIVED', 2),
    ('SUBMIT_FOR_ACCEPTANCE', 'DELIVERABLES_SUBMITTED', 'PASSED', 1),
    ('START_CLOSURE', 'DELIVERABLES_ACCEPTED', 'PASSED', 1),
    ('CLOSE_CASE', 'FINANCIAL_SETTLEMENT', 'PASSED_OR_WAIVED', 1),
    ('CLOSE_CASE', 'BLOCKING_EXCEPTIONS_RESOLVED', 'PASSED', 2)
)
INSERT INTO delivery.service_case_transition_gate_requirements (
  service_case_transition_rule_id, gate_code,
  required_decision_code, display_order
)
SELECT r.service_case_transition_rule_id, g.gate_code, g.decision_code, g.display_order
FROM gate_requirements g
JOIN delivery.service_case_transition_rules r ON r.rule_code = g.rule_code
JOIN delivery.service_case_workflow_versions w
  ON w.service_case_workflow_version_id = r.service_case_workflow_version_id
WHERE w.workflow_code = 'SERVICE_CASE_STANDARD' AND w.version_no = 1;

CREATE VIEW delivery.v_service_case_transition_readiness AS
SELECT
  c.service_case_id,
  c.case_number,
  c.lifecycle_stage_code,
  r.service_case_transition_rule_id,
  r.rule_code,
  r.to_stage_code,
  r.command_code,
  w.enforcement_mode_code,
  count(g.service_case_transition_gate_requirement_id)::integer
    AS required_gate_count,
  count(g.service_case_transition_gate_requirement_id)
    FILTER (
      WHERE cg.decision_code = 'PASSED'
        OR (
          g.required_decision_code = 'PASSED_OR_WAIVED'
          AND cg.decision_code = 'WAIVED'
        )
    )::integer AS satisfied_gate_count,
  coalesce(
    bool_and(
      NOT g.is_blocking
      OR cg.decision_code = 'PASSED'
      OR (
        g.required_decision_code = 'PASSED_OR_WAIVED'
        AND cg.decision_code = 'WAIVED'
      )
    ) FILTER (
      WHERE g.service_case_transition_gate_requirement_id IS NOT NULL
    ),
    true
  ) AS gates_ready
FROM delivery.service_cases c
JOIN delivery.service_case_workflow_versions w
  ON w.workflow_code = 'SERVICE_CASE_STANDARD'
 AND w.version_no = 1
JOIN delivery.service_case_transition_rules r
  ON r.service_case_workflow_version_id = w.service_case_workflow_version_id
 AND r.from_stage_code = c.lifecycle_stage_code
 AND r.is_active
LEFT JOIN delivery.service_case_transition_gate_requirements g
  ON g.service_case_transition_rule_id = r.service_case_transition_rule_id
LEFT JOIN LATERAL (
  SELECT x.decision_code
  FROM delivery.service_case_gates x
  WHERE x.service_case_id = c.service_case_id
    AND x.gate_code = g.gate_code
  ORDER BY x.gate_version DESC
  LIMIT 1
) cg ON true
GROUP BY
  c.service_case_id, r.service_case_transition_rule_id,
  w.enforcement_mode_code;

CREATE VIEW delivery.v_service_case_workflow_monitor AS
SELECT
  a.service_case_transition_attempt_id,
  c.case_number,
  a.from_stage_code,
  a.requested_to_stage_code,
  a.enforcement_mode_code,
  a.evaluation_decision_code,
  a.rule_matched,
  a.role_check_passed,
  a.gate_check_passed,
  a.sod_check_passed,
  a.reasons,
  a.evaluated_at,
  a.executed_at
FROM delivery.service_case_transition_attempts a
JOIN delivery.service_cases c ON c.service_case_id = a.service_case_id
WHERE a.enforcement_mode_code = 'MONITOR_ONLY'
ORDER BY a.evaluated_at DESC;

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0250_v77_service_workflow_governance')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
