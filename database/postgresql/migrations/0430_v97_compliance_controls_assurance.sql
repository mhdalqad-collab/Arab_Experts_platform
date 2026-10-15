BEGIN;

CREATE TABLE governance.compliance_frameworks (
  compliance_framework_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_code varchar(50) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  name_en varchar(240),
  authority_name varchar(240) NOT NULL,
  jurisdiction_code varchar(40) NOT NULL,
  version_label varchar(60) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT','ACTIVE','SUPERSEDED','RETIRED')),
  source_reference text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE governance.compliance_obligations (
  compliance_obligation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_framework_id uuid NOT NULL
    REFERENCES governance.compliance_frameworks(compliance_framework_id) ON DELETE RESTRICT,
  obligation_code varchar(80) NOT NULL,
  title_ar varchar(300) NOT NULL,
  requirement_text text NOT NULL,
  applicability_rule jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(applicability_rule) = 'object'),
  evidence_expectations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence_expectations) = 'array'),
  criticality_code varchar(12) NOT NULL
    CHECK (criticality_code IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  review_frequency_days integer NOT NULL CHECK (review_frequency_days > 0),
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT','ACTIVE','SUPERSEDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (compliance_framework_id, obligation_code)
);

CREATE TABLE governance.compliance_controls (
  compliance_control_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(300) NOT NULL,
  objective_text text NOT NULL,
  control_type_code varchar(16) NOT NULL
    CHECK (control_type_code IN ('PREVENTIVE','DETECTIVE','CORRECTIVE','DIRECTIVE')),
  execution_mode_code varchar(16) NOT NULL
    CHECK (execution_mode_code IN ('MANUAL','AUTOMATED','HYBRID')),
  frequency_code varchar(20) NOT NULL
    CHECK (frequency_code IN ('CONTINUOUS','DAILY','WEEKLY','MONTHLY','QUARTERLY','ANNUAL','EVENT_DRIVEN')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  operator_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence_requirements) = 'array'),
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (operator_party_id IS NULL OR operator_party_id <> owner_party_id)
);

CREATE TABLE governance.compliance_control_mappings (
  compliance_control_mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_control_id uuid NOT NULL
    REFERENCES governance.compliance_controls(compliance_control_id) ON DELETE RESTRICT,
  compliance_obligation_id uuid NOT NULL
    REFERENCES governance.compliance_obligations(compliance_obligation_id) ON DELETE RESTRICT,
  coverage_code varchar(16) NOT NULL
    CHECK (coverage_code IN ('FULL','PARTIAL','SUPPORTING')),
  mapping_rationale text NOT NULL,
  mapped_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  mapped_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  UNIQUE (compliance_control_id, compliance_obligation_id),
  CHECK (valid_to IS NULL OR valid_to >= mapped_at)
);

CREATE TABLE governance.compliance_control_tests (
  compliance_control_test_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_control_id uuid NOT NULL
    REFERENCES governance.compliance_controls(compliance_control_id) ON DELETE RESTRICT,
  test_period_start date NOT NULL,
  test_period_end date NOT NULL,
  tested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  tested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sample_size integer CHECK (sample_size IS NULL OR sample_size > 0),
  result_code varchar(20) NOT NULL
    CHECK (result_code IN ('EFFECTIVE','PARTIALLY_EFFECTIVE','INEFFECTIVE','NOT_TESTED')),
  exceptions_count integer NOT NULL DEFAULT 0 CHECK (exceptions_count >= 0),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(findings) = 'array'),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
  corrective_action text,
  corrective_action_due_at timestamptz,
  reviewed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  CHECK (test_period_end >= test_period_start),
  CHECK (reviewed_by_party_id IS NULL OR reviewed_by_party_id <> tested_by_party_id),
  CHECK (result_code NOT IN ('PARTIALLY_EFFECTIVE','INEFFECTIVE') OR
    (corrective_action IS NOT NULL AND corrective_action_due_at IS NOT NULL))
);

CREATE VIEW governance.v_compliance_control_posture AS
SELECT
  c.compliance_control_id,
  c.control_code,
  c.title_ar,
  c.status_code,
  count(DISTINCT m.compliance_obligation_id) AS mapped_obligation_count,
  CASE
    WHEN c.status_code <> 'ACTIVE' THEN 'CONTROL_NOT_ACTIVE'
    WHEN count(DISTINCT m.compliance_obligation_id) = 0 THEN 'OBLIGATION_MAPPING_REQUIRED'
    WHEN latest.compliance_control_test_id IS NULL THEN 'TEST_REQUIRED'
    WHEN latest.result_code = 'INEFFECTIVE' THEN 'REMEDIATION_REQUIRED'
    WHEN latest.result_code = 'PARTIALLY_EFFECTIVE' THEN 'IMPROVEMENT_REQUIRED'
    WHEN latest.reviewed_at IS NULL THEN 'INDEPENDENT_REVIEW_REQUIRED'
    ELSE 'ASSURED'
  END AS assurance_code,
  latest.result_code AS latest_result_code,
  latest.tested_at AS latest_tested_at,
  latest.reviewed_at AS latest_reviewed_at
FROM governance.compliance_controls c
LEFT JOIN governance.compliance_control_mappings m
  ON m.compliance_control_id = c.compliance_control_id AND m.valid_to IS NULL
LEFT JOIN LATERAL (
  SELECT t.* FROM governance.compliance_control_tests t
  WHERE t.compliance_control_id = c.compliance_control_id
  ORDER BY t.tested_at DESC LIMIT 1
) latest ON true
GROUP BY c.compliance_control_id, c.control_code, c.title_ar, c.status_code,
  latest.compliance_control_test_id, latest.result_code, latest.tested_at, latest.reviewed_at;

COMMIT;
