BEGIN;

-- Operationalize the existing retention policies and legal holds without
-- deleting or rewriting any historical privacy or audit record.

CREATE TABLE governance.data_retention_targets (
  data_retention_target_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_policy_id uuid NOT NULL
    REFERENCES governance.retention_policies(retention_policy_id) ON DELETE RESTRICT,
  resource_type varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  tenant_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  trigger_occurred_at timestamptz NOT NULL,
  eligible_at timestamptz NOT NULL,
  status_code varchar(24) NOT NULL DEFAULT 'TRACKED'
    CHECK (status_code IN ('TRACKED','ON_HOLD','ELIGIBLE','QUEUED','DISPOSED','EXEMPTED')),
  exemption_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (retention_policy_id, resource_type, resource_id),
  CHECK (eligible_at >= trigger_occurred_at),
  CHECK (status_code <> 'EXEMPTED' OR exemption_reason IS NOT NULL)
);

CREATE TABLE governance.data_disposition_assessments (
  data_disposition_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_retention_target_id uuid NOT NULL
    REFERENCES governance.data_retention_targets(data_retention_target_id) ON DELETE RESTRICT,
  assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  legal_hold_checked boolean NOT NULL DEFAULT false,
  dependency_checked boolean NOT NULL DEFAULT false,
  backup_scope_checked boolean NOT NULL DEFAULT false,
  decision_code varchar(24) NOT NULL
    CHECK (decision_code IN ('APPROVE','DEFER','EXEMPT','REJECT')),
  decision_reason text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  valid_until timestamptz NOT NULL,
  CHECK (valid_until > assessed_at),
  CHECK (decision_code <> 'APPROVE' OR
    (legal_hold_checked AND dependency_checked AND backup_scope_checked))
);

CREATE TABLE governance.data_disposition_batches (
  data_disposition_batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code varchar(60) NOT NULL UNIQUE,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  execution_mode_code varchar(20) NOT NULL DEFAULT 'DRY_RUN'
    CHECK (execution_mode_code IN ('DRY_RUN','CONTROLLED_EXECUTION')),
  status_code varchar(24) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT','UNDER_REVIEW','APPROVED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED')),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  execution_receipt_hash char(64),
  CHECK (approved_by_party_id IS NULL OR approved_by_party_id <> requested_by_party_id),
  CHECK (status_code NOT IN ('APPROVED','RUNNING','COMPLETED','PARTIAL') OR approved_by_party_id IS NOT NULL),
  CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);

CREATE TABLE governance.data_disposition_items (
  data_disposition_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_disposition_batch_id uuid NOT NULL
    REFERENCES governance.data_disposition_batches(data_disposition_batch_id) ON DELETE RESTRICT,
  data_retention_target_id uuid NOT NULL
    REFERENCES governance.data_retention_targets(data_retention_target_id) ON DELETE RESTRICT,
  data_disposition_assessment_id uuid NOT NULL
    REFERENCES governance.data_disposition_assessments(data_disposition_assessment_id) ON DELETE RESTRICT,
  action_code varchar(20) NOT NULL
    CHECK (action_code IN ('ARCHIVE','ANONYMIZE','DELETE','REVIEW')),
  result_code varchar(24) NOT NULL DEFAULT 'PENDING'
    CHECK (result_code IN ('PENDING','BLOCKED_BY_HOLD','SKIPPED','SUCCEEDED','FAILED')),
  executed_at timestamptz,
  evidence_hash char(64),
  failure_reason text,
  UNIQUE (data_disposition_batch_id, data_retention_target_id),
  CHECK (result_code <> 'SUCCEEDED' OR (executed_at IS NOT NULL AND evidence_hash IS NOT NULL)),
  CHECK (result_code <> 'FAILED' OR failure_reason IS NOT NULL)
);

CREATE VIEW governance.v_data_disposition_readiness AS
SELECT
  t.data_retention_target_id,
  t.resource_type,
  t.resource_id,
  p.retention_policy_code,
  p.terminal_action_code,
  t.eligible_at,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM governance.legal_holds h
      WHERE h.resource_type = t.resource_type
        AND h.resource_id = t.resource_id
        AND h.status_code = 'ACTIVE'
        AND (h.ends_at IS NULL OR h.ends_at > clock_timestamp())
    ) THEN 'LEGAL_HOLD_BLOCKED'
    WHEN t.status_code = 'EXEMPTED' THEN 'EXEMPTED'
    WHEN t.eligible_at > clock_timestamp() THEN 'NOT_YET_ELIGIBLE'
    WHEN NOT EXISTS (
      SELECT 1 FROM governance.data_disposition_assessments a
      WHERE a.data_retention_target_id = t.data_retention_target_id
        AND a.decision_code = 'APPROVE'
        AND a.valid_until > clock_timestamp()
    ) THEN 'ASSESSMENT_REQUIRED'
    ELSE 'READY'
  END AS readiness_code
FROM governance.data_retention_targets t
JOIN governance.retention_policies p ON p.retention_policy_id = t.retention_policy_id;

COMMIT;
