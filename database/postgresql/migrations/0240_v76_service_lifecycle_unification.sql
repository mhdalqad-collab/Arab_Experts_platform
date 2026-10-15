BEGIN;

-- Package E adds an orchestration spine over the existing need, request,
-- matching, proposal, contract, project, delivery, and closure aggregates.
-- Domain tables remain authoritative and no existing identifier is changed.

CREATE TABLE delivery.service_cases (
  service_case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number varchar(50) NOT NULL UNIQUE,
  client_need_id uuid NOT NULL
    REFERENCES needs.client_needs(client_need_id) ON DELETE RESTRICT,
  need_version_id uuid NOT NULL,
  service_request_id uuid NOT NULL UNIQUE
    REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  client_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  selected_provider_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  selected_proposal_id uuid,
  engagement_id uuid REFERENCES delivery.engagements(engagement_id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  primary_project_id uuid REFERENCES delivery.projects(project_id) ON DELETE RESTRICT,
  lifecycle_stage_code varchar(30) NOT NULL
    CHECK (lifecycle_stage_code IN (
      'NEED', 'REQUEST', 'QUALIFICATION', 'MATCHING', 'COMPARISON',
      'PROPOSAL', 'SELECTION', 'CONTRACTING', 'DELIVERY',
      'ACCEPTANCE', 'CLOSURE', 'CLOSED', 'CANCELLED'
    )),
  lifecycle_status_code varchar(30) NOT NULL
    CHECK (lifecycle_status_code IN (
      'OPEN', 'WAITING_CLIENT', 'WAITING_PROVIDER', 'WAITING_PLATFORM',
      'ON_HOLD', 'COMPLETED', 'CANCELLED', 'CLOSED_NO_AWARD'
    )),
  opened_at timestamptz NOT NULL,
  completed_at timestamptz,
  closed_at timestamptz,
  legacy_source_table varchar(80) NOT NULL DEFAULT 'needs.service_requests',
  legacy_source_id uuid NOT NULL UNIQUE,
  source_snapshot jsonb NOT NULL,
  source_schema_version integer NOT NULL DEFAULT 1 CHECK (source_schema_version > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (need_version_id, client_need_id)
    REFERENCES needs.need_versions(need_version_id, client_need_id) ON DELETE RESTRICT,
  FOREIGN KEY (selected_proposal_id, service_request_id)
    REFERENCES needs.proposals(proposal_id, service_request_id) ON DELETE RESTRICT,
  CONSTRAINT ck_service_case_legacy_identity
    CHECK (service_request_id = legacy_source_id),
  CONSTRAINT ck_service_case_completion
    CHECK (
      lifecycle_status_code NOT IN ('COMPLETED', 'CANCELLED', 'CLOSED_NO_AWARD')
      OR completed_at IS NOT NULL
    ),
  CONSTRAINT ck_service_case_closure
    CHECK (lifecycle_status_code <> 'COMPLETED' OR closed_at IS NOT NULL)
);

CREATE INDEX ix_service_cases_client_stage
  ON delivery.service_cases(client_party_id, lifecycle_stage_code, updated_at DESC);

CREATE INDEX ix_service_cases_provider_stage
  ON delivery.service_cases(selected_provider_party_id, lifecycle_stage_code, updated_at DESC)
  WHERE selected_provider_party_id IS NOT NULL;

CREATE TRIGGER trg_service_cases_updated
BEFORE UPDATE ON delivery.service_cases
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE delivery.service_case_links (
  service_case_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_id uuid NOT NULL
    REFERENCES delivery.service_cases(service_case_id) ON DELETE CASCADE,
  linked_entity_type varchar(50) NOT NULL
    CHECK (linked_entity_type IN (
      'NEED', 'NEED_VERSION', 'SERVICE_REQUEST', 'MATCHING_RUN',
      'COMPARISON', 'SHORTLIST', 'PROPOSAL', 'EXPERT_TEAM',
      'ENGAGEMENT', 'CONTRACT', 'PROJECT', 'DELIVERABLE',
      'INVOICE', 'PAYMENT', 'CLOSURE'
    )),
  linked_entity_id uuid NOT NULL,
  link_role_code varchar(40) NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source_code varchar(20) NOT NULL DEFAULT 'BACKFILL'
    CHECK (source_code IN ('BACKFILL', 'SYSTEM', 'USER', 'INTEGRATION')),
  UNIQUE (service_case_id, linked_entity_type, linked_entity_id, link_role_code)
);

CREATE UNIQUE INDEX uq_service_case_primary_link
  ON delivery.service_case_links(service_case_id, linked_entity_type)
  WHERE is_primary;

CREATE INDEX ix_service_case_links_reverse
  ON delivery.service_case_links(linked_entity_type, linked_entity_id);

CREATE TABLE delivery.service_case_stage_events (
  service_case_stage_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_id uuid NOT NULL
    REFERENCES delivery.service_cases(service_case_id) ON DELETE CASCADE,
  from_stage_code varchar(30),
  to_stage_code varchar(30) NOT NULL,
  source_status_code varchar(40),
  reason_code varchar(50),
  comment text,
  changed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  is_automatic boolean NOT NULL DEFAULT false,
  source_event_table varchar(100),
  source_event_id uuid,
  correlation_id varchar(100),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_service_case_stage_event_change
    CHECK (from_stage_code IS NULL OR from_stage_code <> to_stage_code),
  UNIQUE (source_event_table, source_event_id)
);

CREATE INDEX ix_service_case_stage_events_case_time
  ON delivery.service_case_stage_events(service_case_id, occurred_at);

CREATE TABLE delivery.service_case_gates (
  service_case_gate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_id uuid NOT NULL
    REFERENCES delivery.service_cases(service_case_id) ON DELETE CASCADE,
  gate_code varchar(60) NOT NULL,
  gate_stage_code varchar(30) NOT NULL,
  gate_version integer NOT NULL DEFAULT 1 CHECK (gate_version > 0),
  decision_code varchar(20) NOT NULL
    CHECK (decision_code IN ('PENDING', 'PASSED', 'FAILED', 'WAIVED')),
  criteria_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  decided_at timestamptz,
  waiver_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_service_case_gate_decision
    CHECK (
      decision_code = 'PENDING'
      OR (decided_by_party_id IS NOT NULL AND decided_at IS NOT NULL)
    ),
  CONSTRAINT ck_service_case_gate_waiver
    CHECK (decision_code <> 'WAIVED' OR waiver_reason IS NOT NULL),
  UNIQUE (service_case_id, gate_code, gate_version)
);

CREATE TABLE delivery.service_case_exceptions (
  service_case_exception_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_case_id uuid NOT NULL
    REFERENCES delivery.service_cases(service_case_id) ON DELETE CASCADE,
  exception_code varchar(60) NOT NULL,
  severity_code varchar(20) NOT NULL
    CHECK (severity_code IN ('INFO', 'WARNING', 'ERROR', 'BLOCKING')),
  entity_type varchar(50),
  entity_id uuid,
  description_ar text NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status_code IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WAIVED')),
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  resolution_notes text,
  CONSTRAINT ck_service_case_exception_resolution
    CHECK (
      status_code IN ('OPEN', 'ACKNOWLEDGED')
      OR (resolved_by_party_id IS NOT NULL AND resolved_at IS NOT NULL)
    )
);

WITH resolved AS (
  SELECT
    r.*,
    ca.client_party_id,
    mr.matching_run_id,
    cp.comparison_id,
    sl.shortlist_id,
    e.accepted_proposal_id,
    e.engagement_id,
    e.provider_party_id,
    c.contract_id,
    p.project_id,
    cr.closure_record_id,
    CASE
      WHEN r.status_code = 'CANCELLED' THEN 'CANCELLED'
      WHEN cr.closure_record_id IS NOT NULL THEN 'CLOSED'
      WHEN p.project_id IS NOT NULL THEN 'DELIVERY'
      WHEN c.contract_id IS NOT NULL THEN 'CONTRACTING'
      WHEN e.accepted_proposal_id IS NOT NULL THEN 'SELECTION'
      WHEN EXISTS (
        SELECT 1 FROM needs.proposals pr
        WHERE pr.service_request_id = r.service_request_id
      ) THEN 'PROPOSAL'
      WHEN sl.shortlist_id IS NOT NULL THEN 'COMPARISON'
      WHEN mr.matching_run_id IS NOT NULL THEN 'MATCHING'
      WHEN r.status_code = 'QUALIFICATION' THEN 'QUALIFICATION'
      ELSE 'REQUEST'
    END AS lifecycle_stage_code,
    CASE
      WHEN r.status_code = 'CANCELLED' THEN 'CANCELLED'
      WHEN r.status_code = 'CLOSED_NO_AWARD' THEN 'CLOSED_NO_AWARD'
      WHEN cr.closure_record_id IS NOT NULL THEN 'COMPLETED'
      WHEN r.status_code = 'ON_HOLD' THEN 'ON_HOLD'
      WHEN r.status_code IN ('CLARIFICATION_REQUIRED', 'ACCEPTANCE')
        THEN 'WAITING_CLIENT'
      ELSE 'OPEN'
    END AS lifecycle_status_code
  FROM needs.service_requests r
  JOIN needs.client_needs n ON n.client_need_id = r.client_need_id
  JOIN crm.client_accounts ca ON ca.client_account_id = n.client_account_id
  LEFT JOIN LATERAL (
    SELECT x.matching_run_id
    FROM matching.matching_runs x
    WHERE x.service_request_id = r.service_request_id
    ORDER BY x.run_number DESC
    LIMIT 1
  ) mr ON true
  LEFT JOIN LATERAL (
    SELECT x.comparison_id
    FROM matching.comparisons x
    WHERE x.service_request_id = r.service_request_id
    ORDER BY x.created_at DESC
    LIMIT 1
  ) cp ON true
  LEFT JOIN LATERAL (
    SELECT x.shortlist_id
    FROM matching.shortlists x
    WHERE x.service_request_id = r.service_request_id
    ORDER BY (x.status_code = 'FINAL') DESC, x.version_no DESC
    LIMIT 1
  ) sl ON true
  LEFT JOIN delivery.engagements e ON e.service_request_id = r.service_request_id
  LEFT JOIN finance.contracts c ON c.engagement_id = e.engagement_id
  LEFT JOIN LATERAL (
    SELECT x.project_id
    FROM delivery.projects x
    WHERE x.engagement_id = e.engagement_id
    ORDER BY x.created_at
    LIMIT 1
  ) p ON true
  LEFT JOIN delivery.closure_records cr ON cr.project_id = p.project_id
)
INSERT INTO delivery.service_cases (
  case_number, client_need_id, need_version_id, service_request_id,
  client_party_id, selected_provider_party_id, selected_proposal_id,
  engagement_id, contract_id, primary_project_id, lifecycle_stage_code,
  lifecycle_status_code, opened_at, completed_at, closed_at,
  legacy_source_id, source_snapshot, created_at, updated_at
)
SELECT
  'CASE-' || request_number,
  client_need_id,
  need_version_id,
  service_request_id,
  client_party_id,
  provider_party_id,
  accepted_proposal_id,
  engagement_id,
  contract_id,
  project_id,
  lifecycle_stage_code,
  lifecycle_status_code,
  created_at,
  CASE
    WHEN lifecycle_status_code IN ('COMPLETED', 'CANCELLED', 'CLOSED_NO_AWARD')
      THEN coalesce(updated_at, created_at)
  END,
  CASE WHEN lifecycle_status_code = 'COMPLETED' THEN coalesce(updated_at, created_at) END,
  service_request_id,
  to_jsonb(resolved),
  created_at,
  updated_at
FROM resolved
ON CONFLICT (legacy_source_id) DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT c.service_case_id, link.entity_type, link.entity_id, link.role_code, link.is_primary
FROM delivery.service_cases c
CROSS JOIN LATERAL (
  VALUES
    ('NEED'::varchar(50), c.client_need_id, 'SOURCE'::varchar(40), true),
    ('NEED_VERSION', c.need_version_id, 'FROZEN_INPUT', true),
    ('SERVICE_REQUEST', c.service_request_id, 'ORIGIN', true),
    ('PROPOSAL', c.selected_proposal_id, 'SELECTED', true),
    ('ENGAGEMENT', c.engagement_id, 'DELIVERY_CONTEXT', true),
    ('CONTRACT', c.contract_id, 'GOVERNING', true),
    ('PROJECT', c.primary_project_id, 'PRIMARY', true)
) link(entity_type, entity_id, role_code, is_primary)
WHERE link.entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT c.service_case_id, 'MATCHING_RUN', r.matching_run_id, 'EVALUATION', false
FROM delivery.service_cases c
JOIN matching.matching_runs r ON r.service_request_id = c.service_request_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT
  c.service_case_id,
  'SHORTLIST',
  s.shortlist_id,
  'CLIENT_DECISION',
  row_number() OVER (
    PARTITION BY c.service_case_id
    ORDER BY (s.status_code = 'FINAL') DESC, s.version_no DESC
  ) = 1
FROM delivery.service_cases c
JOIN matching.shortlists s ON s.service_request_id = c.service_request_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT
  c.service_case_id,
  'COMPARISON',
  x.comparison_id,
  'CLIENT_ANALYSIS',
  row_number() OVER (
    PARTITION BY c.service_case_id
    ORDER BY x.created_at DESC
  ) = 1
FROM delivery.service_cases c
JOIN matching.comparisons x ON x.service_request_id = c.service_request_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT c.service_case_id, 'PROPOSAL', p.proposal_id,
  CASE WHEN p.proposal_id = c.selected_proposal_id THEN 'SELECTED' ELSE 'CANDIDATE' END,
  p.proposal_id = c.selected_proposal_id
FROM delivery.service_cases c
JOIN needs.proposals p ON p.service_request_id = c.service_request_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT
  c.service_case_id,
  'EXPERT_TEAM',
  t.expert_team_id,
  'CANDIDATE_TEAM',
  t.expert_team_id = e.expert_team_id
FROM delivery.service_cases c
JOIN matching.expert_teams t ON t.service_request_id = c.service_request_id
LEFT JOIN delivery.engagements e ON e.engagement_id = c.engagement_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT c.service_case_id, 'PROJECT', p.project_id,
  CASE WHEN p.project_id = c.primary_project_id THEN 'PRIMARY' ELSE 'RELATED' END,
  p.project_id = c.primary_project_id
FROM delivery.service_cases c
JOIN delivery.projects p ON p.engagement_id = c.engagement_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT c.service_case_id, 'DELIVERABLE', d.deliverable_id, 'OUTPUT', false
FROM delivery.service_cases c
JOIN delivery.projects p ON p.engagement_id = c.engagement_id
JOIN delivery.deliverables d ON d.project_id = p.project_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT c.service_case_id, 'CLOSURE', x.closure_record_id, 'OUTCOME', true
FROM delivery.service_cases c
JOIN delivery.projects p ON p.engagement_id = c.engagement_id
JOIN delivery.closure_records x ON x.project_id = p.project_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT DISTINCT
  c.service_case_id,
  'INVOICE',
  i.invoice_id,
  'FINANCIAL',
  false
FROM delivery.service_cases c
LEFT JOIN delivery.projects p ON p.engagement_id = c.engagement_id
LEFT JOIN delivery.milestones m ON m.project_id = p.project_id
LEFT JOIN delivery.deliverables d ON d.project_id = p.project_id
JOIN finance.invoices i
  ON i.source_entity_id IN (
    c.contract_id, c.engagement_id, p.project_id, m.milestone_id, d.deliverable_id
  )
WHERE i.source_entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_links (
  service_case_id, linked_entity_type, linked_entity_id,
  link_role_code, is_primary
)
SELECT DISTINCT
  c.service_case_id,
  'PAYMENT',
  a.payment_id,
  'SETTLEMENT',
  false
FROM delivery.service_cases c
JOIN delivery.service_case_links il
  ON il.service_case_id = c.service_case_id
 AND il.linked_entity_type = 'INVOICE'
JOIN finance.payment_allocations a ON a.invoice_id = il.linked_entity_id
ON CONFLICT DO NOTHING;

INSERT INTO delivery.service_case_stage_events (
  service_case_id, from_stage_code, to_stage_code, source_status_code,
  reason_code, comment, changed_by_party_id, is_automatic,
  source_event_table, source_event_id, correlation_id, occurred_at
)
SELECT
  c.service_case_id,
  NULL,
  CASE
    WHEN h.to_status_code IN ('MATCHING', 'CANDIDATES_READY') THEN 'MATCHING'
    WHEN h.to_status_code IN ('PROPOSALS_OPEN', 'EVALUATION') THEN 'PROPOSAL'
    WHEN h.to_status_code IN ('SHORTLISTED') THEN 'COMPARISON'
    WHEN h.to_status_code IN ('SELECTED') THEN 'SELECTION'
    WHEN h.to_status_code IN ('CONTRACTING') THEN 'CONTRACTING'
    WHEN h.to_status_code IN ('IN_DELIVERY') THEN 'DELIVERY'
    WHEN h.to_status_code IN ('ACCEPTANCE') THEN 'ACCEPTANCE'
    WHEN h.to_status_code IN ('COMPLETED') THEN 'CLOSURE'
    WHEN h.to_status_code IN ('CANCELLED', 'CLOSED_NO_AWARD') THEN 'CANCELLED'
    WHEN h.to_status_code IN ('QUALIFICATION', 'CLARIFICATION_REQUIRED') THEN 'QUALIFICATION'
    ELSE 'REQUEST'
  END,
  h.to_status_code,
  h.reason_code,
  h.comment,
  h.changed_by_party_id,
  h.is_automatic,
  'needs.service_request_status_history',
  h.service_request_status_history_id,
  h.request_id,
  h.changed_at
FROM delivery.service_cases c
JOIN needs.service_request_status_history h
  ON h.service_request_id = c.service_request_id
ON CONFLICT (source_event_table, source_event_id) DO NOTHING;

CREATE VIEW delivery.v_service_case_timeline AS
SELECT
  c.service_case_id,
  c.case_number,
  c.lifecycle_stage_code,
  c.lifecycle_status_code,
  c.client_need_id,
  c.service_request_id,
  c.selected_provider_party_id,
  c.selected_proposal_id,
  c.contract_id,
  c.primary_project_id,
  count(DISTINCT l.service_case_link_id)::integer AS linked_entity_count,
  count(DISTINCT e.service_case_exception_id)
    FILTER (WHERE e.status_code IN ('OPEN', 'ACKNOWLEDGED'))::integer
    AS open_exception_count,
  c.opened_at,
  c.completed_at,
  c.closed_at,
  c.updated_at
FROM delivery.service_cases c
LEFT JOIN delivery.service_case_links l ON l.service_case_id = c.service_case_id
LEFT JOIN delivery.service_case_exceptions e ON e.service_case_id = c.service_case_id
GROUP BY c.service_case_id;

CREATE VIEW delivery.v_service_case_traceability AS
SELECT
  c.service_case_id,
  c.case_number,
  l.linked_entity_type,
  l.linked_entity_id,
  l.link_role_code,
  l.is_primary,
  l.linked_at
FROM delivery.service_cases c
JOIN delivery.service_case_links l ON l.service_case_id = c.service_case_id;

WITH run AS (
  INSERT INTO integration.data_reconciliation_runs (
    package_code, entity_family_code, run_type_code,
    status_code, completed_at, parameters
  )
  VALUES (
    'PACKAGE_E_V76', 'SERVICE_LIFECYCLE', 'BACKFILL',
    'SUCCEEDED', clock_timestamp(),
    '{"authority":"domain_aggregates","write_cutover":false,"spine_only":true}'::jsonb
  )
  RETURNING data_reconciliation_run_id
)
INSERT INTO integration.data_reconciliation_metrics (
  data_reconciliation_run_id, source_entity_name, target_entity_name,
  source_count, target_count, matched_count, exception_count
)
SELECT
  run.data_reconciliation_run_id,
  'needs.service_requests',
  'delivery.service_cases',
  (SELECT count(*) FROM needs.service_requests),
  (SELECT count(*) FROM delivery.service_cases),
  (
    SELECT count(*)
    FROM needs.service_requests s
    JOIN delivery.service_cases t ON t.legacy_source_id = s.service_request_id
  ),
  (
    SELECT count(*)
    FROM needs.service_requests s
    LEFT JOIN delivery.service_cases t ON t.legacy_source_id = s.service_request_id
    WHERE t.service_case_id IS NULL
  )
FROM run;

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0240_v76_service_lifecycle_unification')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
