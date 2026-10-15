BEGIN;

CREATE TABLE governance.ai_decision_explanations (
  ai_decision_explanation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automated_decision_record_id uuid NOT NULL REFERENCES governance.automated_decision_records(automated_decision_record_id) ON DELETE RESTRICT,
  ai_model_version_id uuid NOT NULL REFERENCES governance.ai_model_versions(ai_model_version_id) ON DELETE RESTRICT,
  explanation_type_code varchar(24) NOT NULL CHECK (explanation_type_code IN ('GLOBAL','LOCAL','COUNTERFACTUAL','RULE_TRACE','HUMAN_SUMMARY')),
  explanation_ar text NOT NULL,
  decisive_factors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(decisive_factors) = 'array'),
  excluded_sensitive_factors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(excluded_sensitive_factors) = 'array'),
  confidence_statement text NOT NULL,
  limitations_text text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  CHECK (reviewed_at IS NULL OR reviewed_by_party_id IS NOT NULL),
  UNIQUE (automated_decision_record_id, explanation_type_code)
);

CREATE TABLE governance.ai_decision_notices (
  ai_decision_notice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automated_decision_record_id uuid NOT NULL REFERENCES governance.automated_decision_records(automated_decision_record_id) ON DELETE RESTRICT,
  recipient_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  notice_type_code varchar(24) NOT NULL CHECK (notice_type_code IN ('DECISION','RECOMMENDATION','MATERIAL_CHANGE','SUSPENSION','CORRECTION')),
  language_code varchar(8) NOT NULL,
  notice_snapshot jsonb NOT NULL CHECK (jsonb_typeof(notice_snapshot) = 'object'),
  explanation_included boolean NOT NULL DEFAULT false,
  contest_instructions_included boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  delivery_channel_code varchar(20) CHECK (delivery_channel_code IS NULL OR delivery_channel_code IN ('IN_APP','EMAIL','SMS','LETTER')),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (delivered_at IS NULL OR delivery_channel_code IS NOT NULL),
  CHECK (acknowledged_at IS NULL OR delivered_at IS NOT NULL)
);

CREATE TABLE governance.ai_human_override_records (
  ai_human_override_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automated_decision_record_id uuid NOT NULL REFERENCES governance.automated_decision_records(automated_decision_record_id) ON DELETE RESTRICT,
  override_code varchar(24) NOT NULL CHECK (override_code IN ('CONFIRM','MODIFY','REVERSE','PAUSE','REQUEST_MORE_EVIDENCE')),
  original_outcome_snapshot jsonb NOT NULL CHECK (jsonb_typeof(original_outcome_snapshot) = 'object'),
  final_outcome_snapshot jsonb NOT NULL CHECK (jsonb_typeof(final_outcome_snapshot) = 'object'),
  reason_text text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
  overridden_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  overridden_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approval_request_id uuid REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  CHECK (override_code = 'CONFIRM' OR evidence_refs <> '[]'::jsonb)
);

CREATE TABLE governance.ai_decision_contests (
  ai_decision_contest_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automated_decision_record_id uuid NOT NULL REFERENCES governance.automated_decision_records(automated_decision_record_id) ON DELETE RESTRICT,
  claimant_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  contest_reason_code varchar(28) NOT NULL CHECK (contest_reason_code IN ('INACCURATE_DATA','UNFAIR_OUTCOME','MISSING_CONTEXT','UNEXPLAINED_OUTCOME','PRIVACY_CONCERN','OTHER')),
  statement_text text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
  status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status_code IN ('OPEN','TRIAGED','UNDER_REVIEW','UPHELD','OVERTURNED','PARTIALLY_UPHELD','WITHDRAWN','CLOSED')),
  assigned_reviewer_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  resolution_text text,
  resolution_override_id uuid REFERENCES governance.ai_human_override_records(ai_human_override_record_id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  due_at timestamptz NOT NULL,
  resolved_at timestamptz,
  CHECK (assigned_reviewer_party_id IS NULL OR assigned_reviewer_party_id <> claimant_party_id),
  CHECK (resolved_at IS NULL OR resolution_text IS NOT NULL),
  CHECK (status_code NOT IN ('OVERTURNED','PARTIALLY_UPHELD') OR resolution_override_id IS NOT NULL),
  CHECK (due_at > submitted_at)
);

CREATE TABLE governance.ai_decision_incidents (
  ai_decision_incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_system_id uuid NOT NULL REFERENCES governance.ai_systems(ai_system_id) ON DELETE RESTRICT,
  ai_model_version_id uuid REFERENCES governance.ai_model_versions(ai_model_version_id) ON DELETE RESTRICT,
  automated_decision_record_id uuid REFERENCES governance.automated_decision_records(automated_decision_record_id) ON DELETE RESTRICT,
  incident_type_code varchar(28) NOT NULL CHECK (incident_type_code IN ('HARMFUL_OUTPUT','SYSTEMIC_BIAS','PRIVACY_BREACH','SECURITY_FAILURE','EXPLANATION_FAILURE','DRIFT','UNAUTHORIZED_AUTOMATION','OTHER')),
  severity_code varchar(12) NOT NULL CHECK (severity_code IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  detected_at timestamptz NOT NULL,
  detected_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  description_text text NOT NULL,
  affected_scope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(affected_scope) = 'object'),
  containment_text text,
  root_cause_text text,
  corrective_action_text text,
  status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status_code IN ('OPEN','CONTAINED','INVESTIGATING','REMEDIATING','VERIFYING','CLOSED')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  closed_at timestamptz,
  verified_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CHECK (status_code <> 'CLOSED' OR (closed_at IS NOT NULL AND root_cause_text IS NOT NULL AND corrective_action_text IS NOT NULL AND verified_by_party_id IS NOT NULL)),
  CHECK (verified_by_party_id IS NULL OR verified_by_party_id <> owner_party_id)
);

CREATE VIEW governance.v_ai_decision_due_process AS
SELECT r.automated_decision_record_id,
       CASE
         WHEN r.human_review_required AND NOT EXISTS (SELECT 1 FROM governance.ai_human_override_records o WHERE o.automated_decision_record_id = r.automated_decision_record_id) THEN 'HUMAN_REVIEW_REQUIRED'
         WHEN NOT EXISTS (SELECT 1 FROM governance.ai_decision_explanations e WHERE e.automated_decision_record_id = r.automated_decision_record_id) THEN 'EXPLANATION_REQUIRED'
         WHEN NOT EXISTS (SELECT 1 FROM governance.ai_decision_notices n WHERE n.automated_decision_record_id = r.automated_decision_record_id AND n.delivered_at IS NOT NULL AND n.contest_instructions_included) THEN 'NOTICE_AND_CONTEST_RIGHT_REQUIRED'
         WHEN EXISTS (SELECT 1 FROM governance.ai_decision_contests c WHERE c.automated_decision_record_id = r.automated_decision_record_id AND c.status_code NOT IN ('UPHELD','OVERTURNED','PARTIALLY_UPHELD','WITHDRAWN','CLOSED') AND c.due_at < clock_timestamp()) THEN 'CONTEST_OVERDUE'
         ELSE 'DUE_PROCESS_COMPLETE'
       END AS due_process_code
FROM governance.automated_decision_records r;

COMMIT;
