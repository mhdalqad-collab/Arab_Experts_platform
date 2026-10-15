BEGIN;

CREATE TABLE governance.enterprise_risks (
  enterprise_risk_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(300) NOT NULL,
  description_text text NOT NULL,
  category_code varchar(24) NOT NULL
    CHECK (category_code IN ('STRATEGIC','OPERATIONAL','FINANCIAL','LEGAL_COMPLIANCE','CYBER_SECURITY','PRIVACY','REPUTATION','VENDOR','CONTINUITY','PROJECT')),
  source_code varchar(24) NOT NULL
    CHECK (source_code IN ('INTERNAL','EXTERNAL','AUDIT','INCIDENT','ASSESSMENT','COMPLAINT','CHANGE','VENDOR')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  accountable_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  risk_appetite_code varchar(16) NOT NULL
    CHECK (risk_appetite_code IN ('AVOID','MINIMAL','CAUTIOUS','OPEN','SEEK')),
  status_code varchar(20) NOT NULL DEFAULT 'IDENTIFIED'
    CHECK (status_code IN ('IDENTIFIED','ASSESSED','TREATING','MONITORING','ACCEPTED','CLOSED')),
  identified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  closure_reason text,
  CHECK (owner_party_id <> accountable_party_id),
  CHECK (status_code <> 'CLOSED' OR (closed_at IS NOT NULL AND closure_reason IS NOT NULL))
);

CREATE TABLE governance.enterprise_risk_assessments (
  enterprise_risk_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_risk_id uuid NOT NULL
    REFERENCES governance.enterprise_risks(enterprise_risk_id) ON DELETE RESTRICT,
  assessment_type_code varchar(16) NOT NULL
    CHECK (assessment_type_code IN ('INHERENT','RESIDUAL','TARGET')),
  likelihood_score smallint NOT NULL CHECK (likelihood_score BETWEEN 1 AND 5),
  impact_score smallint NOT NULL CHECK (impact_score BETWEEN 1 AND 5),
  velocity_score smallint NOT NULL CHECK (velocity_score BETWEEN 1 AND 5),
  calculated_score integer GENERATED ALWAYS AS (likelihood_score * impact_score) STORED,
  rationale text NOT NULL,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(assumptions) = 'array'),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs) = 'array'),
  assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  next_review_at timestamptz NOT NULL,
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  CHECK (next_review_at > assessed_at),
  CHECK (approved_by_party_id IS NULL OR approved_by_party_id <> assessed_by_party_id)
);

CREATE TABLE governance.enterprise_risk_control_links (
  enterprise_risk_control_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_risk_id uuid NOT NULL
    REFERENCES governance.enterprise_risks(enterprise_risk_id) ON DELETE RESTRICT,
  compliance_control_id uuid NOT NULL
    REFERENCES governance.compliance_controls(compliance_control_id) ON DELETE RESTRICT,
  effectiveness_weight numeric(5,2) NOT NULL CHECK (effectiveness_weight BETWEEN 0 AND 100),
  linkage_rationale text NOT NULL,
  linked_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  UNIQUE (enterprise_risk_id, compliance_control_id),
  CHECK (valid_to IS NULL OR valid_to >= linked_at)
);

CREATE TABLE governance.enterprise_risk_treatment_plans (
  enterprise_risk_treatment_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_risk_id uuid NOT NULL
    REFERENCES governance.enterprise_risks(enterprise_risk_id) ON DELETE RESTRICT,
  treatment_code varchar(16) NOT NULL
    CHECK (treatment_code IN ('AVOID','REDUCE','TRANSFER','SHARE','ACCEPT')),
  action_text text NOT NULL,
  action_owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  due_at timestamptz NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status_code IN ('PLANNED','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED')),
  completion_evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(completion_evidence_refs) = 'array'),
  effectiveness_verified_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  effectiveness_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (status_code <> 'COMPLETED' OR
    (completion_evidence_refs <> '[]'::jsonb AND effectiveness_verified_by_party_id IS NOT NULL AND effectiveness_verified_at IS NOT NULL)),
  CHECK (effectiveness_verified_by_party_id IS NULL OR effectiveness_verified_by_party_id <> action_owner_party_id)
);

CREATE TABLE governance.enterprise_risk_indicators (
  enterprise_risk_indicator_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_risk_id uuid NOT NULL
    REFERENCES governance.enterprise_risks(enterprise_risk_id) ON DELETE RESTRICT,
  indicator_code varchar(60) NOT NULL,
  name_ar varchar(240) NOT NULL,
  unit_code varchar(30) NOT NULL,
  warning_threshold numeric(18,5) NOT NULL,
  critical_threshold numeric(18,5) NOT NULL,
  comparison_operator varchar(4) NOT NULL CHECK (comparison_operator IN ('>=','<=','>','<')),
  current_value numeric(18,5),
  measured_at timestamptz,
  source_reference text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  UNIQUE (enterprise_risk_id, indicator_code),
  CHECK (current_value IS NULL OR measured_at IS NOT NULL)
);

CREATE VIEW governance.v_enterprise_risk_posture AS
SELECT
  r.enterprise_risk_id,
  r.risk_code,
  r.title_ar,
  r.category_code,
  r.status_code,
  latest.calculated_score AS latest_risk_score,
  latest.next_review_at,
  CASE
    WHEN latest.enterprise_risk_assessment_id IS NULL THEN 'ASSESSMENT_REQUIRED'
    WHEN latest.approved_at IS NULL THEN 'ASSESSMENT_APPROVAL_REQUIRED'
    WHEN latest.next_review_at <= clock_timestamp() THEN 'REASSESSMENT_OVERDUE'
    WHEN r.status_code = 'CLOSED' AND EXISTS (
      SELECT 1 FROM governance.enterprise_risk_treatment_plans p
      WHERE p.enterprise_risk_id = r.enterprise_risk_id
        AND (p.status_code <> 'COMPLETED' OR p.effectiveness_verified_at IS NULL)
    ) THEN 'INVALID_CLOSURE'
    WHEN EXISTS (
      SELECT 1 FROM governance.enterprise_risk_treatment_plans p
      WHERE p.enterprise_risk_id = r.enterprise_risk_id
        AND p.status_code NOT IN ('COMPLETED','CANCELLED') AND p.due_at < clock_timestamp()
    ) THEN 'TREATMENT_OVERDUE'
    WHEN latest.calculated_score >= 15 AND NOT EXISTS (
      SELECT 1 FROM governance.enterprise_risk_control_links l
      WHERE l.enterprise_risk_id = r.enterprise_risk_id AND l.valid_to IS NULL
    ) THEN 'CONTROL_COVERAGE_REQUIRED'
    ELSE 'MONITORED'
  END AS posture_code
FROM governance.enterprise_risks r
LEFT JOIN LATERAL (
  SELECT a.* FROM governance.enterprise_risk_assessments a
  WHERE a.enterprise_risk_id = r.enterprise_risk_id
  ORDER BY a.assessed_at DESC LIMIT 1
) latest ON true;

COMMIT;
