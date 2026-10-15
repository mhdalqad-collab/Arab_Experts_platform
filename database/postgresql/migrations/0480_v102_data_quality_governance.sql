BEGIN;

CREATE TABLE quality.data_products (
  data_product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_product_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  domain_code varchar(60) NOT NULL,
  resource_type varchar(100) NOT NULL,
  description_text text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  steward_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  sensitivity_code varchar(20) NOT NULL
    CHECK (sensitivity_code IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  criticality_code varchar(12) NOT NULL
    CHECK (criticality_code IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  authoritative_source_reference text NOT NULL,
  refresh_frequency_code varchar(20) NOT NULL
    CHECK (refresh_frequency_code IN ('REAL_TIME','HOURLY','DAILY','WEEKLY','MONTHLY','EVENT_DRIVEN')),
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT','ACTIVE','DEGRADED','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (owner_party_id <> steward_party_id)
);

CREATE TABLE quality.data_quality_rules (
  data_quality_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_product_id uuid NOT NULL
    REFERENCES quality.data_products(data_product_id) ON DELETE RESTRICT,
  rule_code varchar(80) NOT NULL,
  name_ar varchar(240) NOT NULL,
  dimension_code varchar(20) NOT NULL
    CHECK (dimension_code IN ('COMPLETENESS','ACCURACY','VALIDITY','UNIQUENESS','CONSISTENCY','TIMELINESS','INTEGRITY')),
  field_path varchar(240),
  rule_expression text NOT NULL,
  minimum_pass_rate numeric(6,3) NOT NULL CHECK (minimum_pass_rate BETWEEN 0 AND 100),
  severity_code varchar(12) NOT NULL
    CHECK (severity_code IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  failure_action_code varchar(24) NOT NULL
    CHECK (failure_action_code IN ('MONITOR','WARN','QUARANTINE','BLOCK_PUBLICATION','BLOCK_MATCHING')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (data_product_id, rule_code)
);

CREATE TABLE quality.data_quality_runs (
  data_quality_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_product_id uuid NOT NULL
    REFERENCES quality.data_products(data_product_id) ON DELETE RESTRICT,
  run_code varchar(80) NOT NULL UNIQUE,
  trigger_code varchar(20) NOT NULL
    CHECK (trigger_code IN ('SCHEDULED','INGESTION','PRE_PUBLICATION','PRE_MATCHING','MANUAL','INCIDENT')),
  scope_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(scope_snapshot) = 'object'),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status_code varchar(16) NOT NULL DEFAULT 'RUNNING'
    CHECK (status_code IN ('RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED')),
  records_evaluated bigint NOT NULL DEFAULT 0 CHECK (records_evaluated >= 0),
  executed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  execution_receipt_hash char(64),
  CHECK (completed_at IS NULL OR completed_at >= started_at),
  CHECK (status_code = 'RUNNING' OR (completed_at IS NOT NULL AND execution_receipt_hash IS NOT NULL))
);

CREATE TABLE quality.data_quality_results (
  data_quality_result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_quality_run_id uuid NOT NULL
    REFERENCES quality.data_quality_runs(data_quality_run_id) ON DELETE RESTRICT,
  data_quality_rule_id uuid NOT NULL
    REFERENCES quality.data_quality_rules(data_quality_rule_id) ON DELETE RESTRICT,
  evaluated_count bigint NOT NULL CHECK (evaluated_count >= 0),
  passed_count bigint NOT NULL CHECK (passed_count >= 0),
  failed_count bigint NOT NULL CHECK (failed_count >= 0),
  pass_rate numeric(6,3) NOT NULL CHECK (pass_rate BETWEEN 0 AND 100),
  outcome_code varchar(16) NOT NULL
    CHECK (outcome_code IN ('PASSED','FAILED','ERROR','NOT_APPLICABLE')),
  sample_failure_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(sample_failure_refs) = 'array'),
  evidence_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (data_quality_run_id, data_quality_rule_id),
  CHECK (passed_count + failed_count = evaluated_count)
);

CREATE TABLE quality.data_quality_issues (
  data_quality_issue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_code varchar(80) NOT NULL UNIQUE,
  data_quality_result_id uuid NOT NULL
    REFERENCES quality.data_quality_results(data_quality_result_id) ON DELETE RESTRICT,
  assigned_to_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  root_cause_text text,
  remediation_action text NOT NULL,
  due_at timestamptz NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status_code IN ('OPEN','INVESTIGATING','REMEDIATING','VERIFIED','ACCEPTED','CLOSED')),
  resolution_evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(resolution_evidence_refs) = 'array'),
  verified_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  verified_at timestamptz,
  accepted_by_owner_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (status_code NOT IN ('VERIFIED','CLOSED') OR
    (verified_by_party_id IS NOT NULL AND verified_at IS NOT NULL AND resolution_evidence_refs <> '[]'::jsonb)),
  CHECK (status_code <> 'CLOSED' OR (accepted_by_owner_party_id IS NOT NULL AND closed_at IS NOT NULL)),
  CHECK (verified_by_party_id IS NULL OR verified_by_party_id <> assigned_to_party_id)
);

CREATE VIEW quality.v_data_product_quality_posture AS
SELECT
  p.data_product_id,
  p.data_product_code,
  p.name_ar,
  p.criticality_code,
  p.status_code,
  latest.data_quality_run_id AS latest_run_id,
  latest.completed_at AS latest_completed_at,
  CASE
    WHEN p.status_code <> 'ACTIVE' THEN 'PRODUCT_NOT_ACTIVE'
    WHEN latest.data_quality_run_id IS NULL THEN 'QUALITY_RUN_REQUIRED'
    WHEN latest.status_code NOT IN ('COMPLETED','PARTIAL') THEN 'RUN_NOT_COMPLETE'
    WHEN EXISTS (
      SELECT 1 FROM quality.data_quality_results r
      JOIN quality.data_quality_rules q ON q.data_quality_rule_id = r.data_quality_rule_id
      WHERE r.data_quality_run_id = latest.data_quality_run_id
        AND r.outcome_code = 'FAILED'
        AND q.failure_action_code IN ('BLOCK_PUBLICATION','BLOCK_MATCHING')
    ) THEN 'CRITICAL_QUALITY_GATE_FAILED'
    WHEN EXISTS (
      SELECT 1 FROM quality.data_quality_issues i
      JOIN quality.data_quality_results r ON r.data_quality_result_id = i.data_quality_result_id
      WHERE r.data_quality_run_id = latest.data_quality_run_id
        AND i.status_code NOT IN ('VERIFIED','CLOSED','ACCEPTED')
        AND i.due_at < clock_timestamp()
    ) THEN 'REMEDIATION_OVERDUE'
    ELSE 'FIT_FOR_USE'
  END AS posture_code
FROM quality.data_products p
LEFT JOIN LATERAL (
  SELECT x.* FROM quality.data_quality_runs x
  WHERE x.data_product_id = p.data_product_id
  ORDER BY x.started_at DESC LIMIT 1
) latest ON true;

COMMIT;
