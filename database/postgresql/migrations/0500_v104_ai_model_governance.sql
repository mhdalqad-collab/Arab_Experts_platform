BEGIN;

CREATE TABLE governance.ai_systems (
  ai_system_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  purpose_text text NOT NULL,
  use_case_code varchar(30) NOT NULL
    CHECK (use_case_code IN ('MATCHING','SEARCH_RANKING','REPUTATION_SCORING','DOCUMENT_EXTRACTION','FRAUD_DETECTION','RECOMMENDATION','SUPPORT_ASSISTANT','ANOMALY_DETECTION')),
  decision_role_code varchar(24) NOT NULL
    CHECK (decision_role_code IN ('ADVISORY','RANKING_SUPPORT','HUMAN_REVIEW_REQUIRED','AUTOMATED_LOW_RISK')),
  risk_tier_code varchar(16) NOT NULL
    CHECK (risk_tier_code IN ('PROHIBITED','HIGH','MEDIUM','LOW','MINIMAL')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  accountable_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  security_asset_id uuid REFERENCES governance.security_assets(security_asset_id) ON DELETE RESTRICT,
  enterprise_risk_id uuid REFERENCES governance.enterprise_risks(enterprise_risk_id) ON DELETE RESTRICT,
  human_override_required boolean NOT NULL DEFAULT true,
  status_code varchar(20) NOT NULL DEFAULT 'PROPOSED'
    CHECK (status_code IN ('PROPOSED','ASSESSING','APPROVED','ACTIVE','SUSPENDED','RETIRED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (owner_party_id <> accountable_party_id),
  CHECK (risk_tier_code <> 'HIGH' OR enterprise_risk_id IS NOT NULL),
  CHECK (use_case_code <> 'MATCHING' OR human_override_required)
);

CREATE TABLE governance.ai_model_versions (
  ai_model_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_system_id uuid NOT NULL REFERENCES governance.ai_systems(ai_system_id) ON DELETE RESTRICT,
  version_label varchar(60) NOT NULL,
  model_type_code varchar(24) NOT NULL
    CHECK (model_type_code IN ('RULE_BASED','STATISTICAL','MACHINE_LEARNING','LARGE_LANGUAGE_MODEL','HYBRID')),
  artifact_reference text NOT NULL,
  artifact_hash char(64) NOT NULL,
  training_data_product_id uuid REFERENCES quality.data_products(data_product_id) ON DELETE RESTRICT,
  feature_data_product_id uuid REFERENCES quality.data_products(data_product_id) ON DELETE RESTRICT,
  training_period_start date,
  training_period_end date,
  intended_population text NOT NULL,
  limitations_text text NOT NULL,
  explainability_method text NOT NULL,
  fallback_method text NOT NULL,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status_code varchar(20) NOT NULL DEFAULT 'CANDIDATE'
    CHECK (status_code IN ('CANDIDATE','VALIDATING','APPROVED','ACTIVE','SUSPENDED','SUPERSEDED','REJECTED')),
  UNIQUE (ai_system_id, version_label),
  CHECK (training_period_end IS NULL OR training_period_start IS NOT NULL),
  CHECK (training_period_end IS NULL OR training_period_end >= training_period_start)
);

CREATE TABLE governance.ai_model_evaluations (
  ai_model_evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_model_version_id uuid NOT NULL
    REFERENCES governance.ai_model_versions(ai_model_version_id) ON DELETE RESTRICT,
  evaluation_type_code varchar(24) NOT NULL
    CHECK (evaluation_type_code IN ('PERFORMANCE','FAIRNESS','ROBUSTNESS','PRIVACY','SECURITY','EXPLAINABILITY','HUMAN_FACTORS')),
  dataset_reference text NOT NULL,
  dataset_hash char(64) NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics) = 'object'),
  threshold_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(threshold_snapshot) = 'object'),
  outcome_code varchar(20) NOT NULL
    CHECK (outcome_code IN ('PASSED','CONDITIONAL','FAILED','INCONCLUSIVE')),
  protected_group_analysis jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(protected_group_analysis) = 'array'),
  limitations_found text,
  evaluated_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CHECK (reviewed_by_party_id IS NULL OR reviewed_by_party_id <> evaluated_by_party_id),
  CHECK (outcome_code <> 'PASSED' OR evidence_refs <> '[]'::jsonb)
);

CREATE TABLE governance.ai_model_monitoring_observations (
  ai_model_monitoring_observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_model_version_id uuid NOT NULL
    REFERENCES governance.ai_model_versions(ai_model_version_id) ON DELETE RESTRICT,
  observation_window_start timestamptz NOT NULL,
  observation_window_end timestamptz NOT NULL,
  metric_code varchar(40) NOT NULL,
  metric_value numeric(18,6) NOT NULL,
  warning_threshold numeric(18,6),
  critical_threshold numeric(18,6),
  drift_code varchar(16) NOT NULL
    CHECK (drift_code IN ('NONE','LOW','MEDIUM','HIGH','CRITICAL')),
  affected_population text,
  sample_size bigint NOT NULL CHECK (sample_size > 0),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  evidence_hash char(64) NOT NULL,
  CHECK (observation_window_end > observation_window_start)
);

CREATE TABLE governance.ai_governance_decisions (
  ai_governance_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_model_version_id uuid NOT NULL
    REFERENCES governance.ai_model_versions(ai_model_version_id) ON DELETE RESTRICT,
  decision_code varchar(24) NOT NULL
    CHECK (decision_code IN ('APPROVE_PILOT','APPROVE_PRODUCTION','CONDITIONAL_APPROVAL','SUSPEND','REJECT','RETIRE','RESUME')),
  decision_reason text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conditions) = 'array'),
  approval_request_id uuid NOT NULL
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  decided_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_from timestamptz NOT NULL,
  expires_at timestamptz,
  rollback_reference text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CHECK (expires_at IS NULL OR expires_at > effective_from),
  CHECK (decision_code NOT IN ('APPROVE_PILOT','APPROVE_PRODUCTION','RESUME') OR evidence_refs <> '[]'::jsonb)
);

CREATE VIEW governance.v_ai_model_readiness AS
SELECT
  v.ai_model_version_id,
  s.system_code,
  v.version_label,
  s.use_case_code,
  s.risk_tier_code,
  v.status_code,
  CASE
    WHEN s.risk_tier_code = 'PROHIBITED' THEN 'PROHIBITED_USE'
    WHEN v.status_code NOT IN ('APPROVED','ACTIVE') THEN 'VERSION_NOT_APPROVED'
    WHEN NOT EXISTS (
      SELECT 1 FROM governance.ai_model_evaluations e
      WHERE e.ai_model_version_id = v.ai_model_version_id
        AND e.evaluation_type_code IN ('PERFORMANCE','FAIRNESS','ROBUSTNESS','PRIVACY','SECURITY','EXPLAINABILITY')
        AND e.outcome_code IN ('PASSED','CONDITIONAL') AND e.reviewed_at IS NOT NULL
      GROUP BY e.ai_model_version_id
      HAVING count(DISTINCT e.evaluation_type_code) = 6
    ) THEN 'EVALUATION_COVERAGE_REQUIRED'
    WHEN EXISTS (
      SELECT 1 FROM governance.ai_model_monitoring_observations o
      WHERE o.ai_model_version_id = v.ai_model_version_id AND o.drift_code IN ('HIGH','CRITICAL')
    ) THEN 'DRIFT_REVIEW_REQUIRED'
    WHEN NOT EXISTS (
      SELECT 1 FROM governance.ai_governance_decisions d
      WHERE d.ai_model_version_id = v.ai_model_version_id
        AND d.decision_code IN ('APPROVE_PILOT','APPROVE_PRODUCTION','CONDITIONAL_APPROVAL','RESUME')
        AND (d.expires_at IS NULL OR d.expires_at > clock_timestamp())
    ) THEN 'GOVERNANCE_DECISION_REQUIRED'
    ELSE 'READY_WITH_HUMAN_OVERSIGHT'
  END AS readiness_code
FROM governance.ai_model_versions v
JOIN governance.ai_systems s ON s.ai_system_id = v.ai_system_id;

COMMIT;
