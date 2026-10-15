BEGIN;

CREATE TABLE integration.platform_vendors (
  platform_vendor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code varchar(40) NOT NULL UNIQUE,
  legal_name varchar(200) NOT NULL,
  country_code char(2) NOT NULL REFERENCES reference.countries(country_code),
  service_category_code varchar(30) NOT NULL,
  criticality_code varchar(12) NOT NULL CHECK(criticality_code IN('CRITICAL','HIGH','MEDIUM','LOW')),
  security_review_status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(security_review_status IN('PENDING','APPROVED','CONDITIONAL','REJECTED','EXPIRED')),
  data_processing_role varchar(20) CHECK(data_processing_role IN('NONE','PROCESSOR','SUBPROCESSOR','CONTROLLER')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ONBOARDING' CHECK(status_code IN('ONBOARDING','ACTIVE','SUSPENDED','EXITING','TERMINATED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE integration.platform_vendor_dependencies (
  platform_vendor_dependency_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_vendor_id uuid NOT NULL REFERENCES integration.platform_vendors(platform_vendor_id) ON DELETE RESTRICT,
  service_scope varchar(100) NOT NULL,
  dependency_type_code varchar(20) NOT NULL CHECK(dependency_type_code IN('HOSTING','DATABASE','IDENTITY','PAYMENT','MESSAGING','STORAGE','OBSERVABILITY','OTHER')),
  concentration_risk_code varchar(12) NOT NULL CHECK(concentration_risk_code IN('LOW','MEDIUM','HIGH','CRITICAL')),
  replacement_vendor_id uuid REFERENCES integration.platform_vendors(platform_vendor_id) ON DELETE RESTRICT,
  exit_plan text NOT NULL,
  maximum_outage_minutes integer NOT NULL CHECK(maximum_outage_minutes>0),
  data_portability_verified boolean NOT NULL DEFAULT false,
  last_exit_test_at timestamptz,
  UNIQUE(platform_vendor_id,service_scope,dependency_type_code),
  CHECK(replacement_vendor_id IS NULL OR replacement_vendor_id<>platform_vendor_id)
);

CREATE TABLE integration.platform_vendor_slas (
  platform_vendor_sla_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_vendor_id uuid NOT NULL REFERENCES integration.platform_vendors(platform_vendor_id) ON DELETE RESTRICT,
  metric_code varchar(30) NOT NULL CHECK(metric_code IN('AVAILABILITY','RESPONSE_TIME','RESOLUTION_TIME','RPO','RTO','SUPPORT_RESPONSE','DELIVERY_SUCCESS')),
  target_operator varchar(4) NOT NULL CHECK(target_operator IN('>=','<=','<','>')),
  target_value numeric(14,5) NOT NULL,
  unit_code varchar(20) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  remedy_terms text NOT NULL,
  CHECK(effective_to IS NULL OR effective_to>=effective_from)
);

CREATE TABLE integration.platform_vendor_assessments (
  platform_vendor_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_vendor_id uuid NOT NULL REFERENCES integration.platform_vendors(platform_vendor_id) ON DELETE RESTRICT,
  assessment_type_code varchar(24) NOT NULL CHECK(assessment_type_code IN('DUE_DILIGENCE','SECURITY','PRIVACY','PERFORMANCE','FINANCIAL','EXIT_TEST')),
  risk_score numeric(6,3) NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
  outcome_code varchar(16) NOT NULL CHECK(outcome_code IN('PASS','CONDITIONAL','FAIL','REVIEW_REQUIRED')),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(findings)='array'),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidence_refs)='array'),
  assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  assessed_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  CHECK(valid_until>assessed_at)
);

CREATE VIEW integration.v_platform_vendor_readiness AS
SELECT v.platform_vendor_id,v.vendor_code,v.legal_name,v.criticality_code,v.status_code,
 count(d.*) AS dependency_count,
 count(d.*) FILTER(WHERE d.concentration_risk_code IN('HIGH','CRITICAL') AND (d.replacement_vendor_id IS NULL OR NOT d.data_portability_verified)) AS uncovered_critical_dependencies,
 CASE WHEN v.status_code<>'ACTIVE' THEN 'NOT_ACTIVE'
      WHEN v.security_review_status NOT IN('APPROVED','CONDITIONAL') THEN 'SECURITY_REVIEW_REQUIRED'
      WHEN NOT EXISTS(SELECT 1 FROM integration.platform_vendor_assessments a WHERE a.platform_vendor_id=v.platform_vendor_id AND a.valid_until>clock_timestamp() AND a.outcome_code IN('PASS','CONDITIONAL')) THEN 'ASSESSMENT_REQUIRED'
      WHEN count(d.*) FILTER(WHERE d.concentration_risk_code IN('HIGH','CRITICAL') AND (d.replacement_vendor_id IS NULL OR NOT d.data_portability_verified))>0 THEN 'EXIT_COVERAGE_REQUIRED'
      ELSE 'READY' END AS readiness_code
FROM integration.platform_vendors v LEFT JOIN integration.platform_vendor_dependencies d ON d.platform_vendor_id=v.platform_vendor_id
GROUP BY v.platform_vendor_id,v.vendor_code,v.legal_name,v.criticality_code,v.status_code,v.security_review_status;

COMMIT;
