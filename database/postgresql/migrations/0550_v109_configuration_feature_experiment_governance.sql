BEGIN;

CREATE TABLE governance.configuration_definitions (
  configuration_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_key varchar(160) NOT NULL UNIQUE,
  name_ar varchar(220) NOT NULL,
  description_text text NOT NULL,
  domain_code varchar(30) NOT NULL CHECK (domain_code IN ('IDENTITY','MEMBERSHIP','SEARCH','MATCHING','TRAINING','SERVICE','FINANCE','QUALITY','COMMUNICATION','LOCALIZATION','PLATFORM')),
  value_type_code varchar(16) NOT NULL CHECK (value_type_code IN ('BOOLEAN','INTEGER','DECIMAL','STRING','JSON','DURATION','PERCENTAGE')),
  validation_schema jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(validation_schema) = 'object'),
  sensitivity_code varchar(16) NOT NULL CHECK (sensitivity_code IN ('PUBLIC','INTERNAL','CONFIDENTIAL','SECRET_REFERENCE')),
  restart_required boolean NOT NULL DEFAULT false,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status_code IN ('DRAFT','ACTIVE','DEPRECATED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.configuration_versions (
  configuration_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_definition_id uuid NOT NULL REFERENCES governance.configuration_definitions(configuration_definition_id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number > 0),
  environment_code varchar(16) NOT NULL CHECK (environment_code IN ('DEVELOPMENT','TEST','STAGING','PRODUCTION')),
  value_snapshot jsonb NOT NULL,
  value_hash char(64) NOT NULL,
  change_reason text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  approval_request_id uuid REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (configuration_definition_id, environment_code, version_number),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (environment_code <> 'PRODUCTION' OR approval_request_id IS NOT NULL)
);

CREATE TABLE governance.feature_flags (
  feature_flag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key varchar(160) NOT NULL UNIQUE,
  name_ar varchar(220) NOT NULL,
  description_text text NOT NULL,
  feature_owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  risk_tier_code varchar(12) NOT NULL CHECK (risk_tier_code IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  default_enabled boolean NOT NULL DEFAULT false,
  emergency_disable_supported boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  platform_release_id uuid REFERENCES delivery.platform_releases(platform_release_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status_code IN ('DRAFT','APPROVED','ACTIVE','PAUSED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (risk_tier_code NOT IN ('HIGH','CRITICAL') OR emergency_disable_supported)
);

CREATE TABLE governance.feature_flag_rules (
  feature_flag_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_flag_id uuid NOT NULL REFERENCES governance.feature_flags(feature_flag_id) ON DELETE RESTRICT,
  rule_priority integer NOT NULL CHECK (rule_priority > 0),
  environment_code varchar(16) NOT NULL CHECK (environment_code IN ('DEVELOPMENT','TEST','STAGING','PRODUCTION')),
  audience_type_code varchar(20) NOT NULL CHECK (audience_type_code IN ('ALL','PARTY','MEMBERSHIP_TYPE','ORGANIZATION','ROLE','COUNTRY','PERCENTAGE')),
  audience_criteria jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(audience_criteria) = 'object'),
  enabled_value boolean NOT NULL,
  rollout_percentage numeric(5,2) CHECK (rollout_percentage IS NULL OR rollout_percentage BETWEEN 0 AND 100),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  approval_request_id uuid REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (feature_flag_id, environment_code, rule_priority),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (audience_type_code <> 'PERCENTAGE' OR rollout_percentage IS NOT NULL),
  CHECK (environment_code <> 'PRODUCTION' OR approval_request_id IS NOT NULL)
);

CREATE TABLE governance.controlled_experiments (
  controlled_experiment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_code varchar(100) NOT NULL UNIQUE,
  name_ar varchar(220) NOT NULL,
  hypothesis_text text NOT NULL,
  feature_flag_id uuid NOT NULL REFERENCES governance.feature_flags(feature_flag_id) ON DELETE RESTRICT,
  primary_metric_definition_id uuid NOT NULL REFERENCES analytics.metric_definitions(metric_definition_id) ON DELETE RESTRICT,
  guardrail_metric_definition_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(guardrail_metric_definition_ids) = 'array'),
  population_definition jsonb NOT NULL CHECK (jsonb_typeof(population_definition) = 'object'),
  assignment_method_code varchar(20) NOT NULL CHECK (assignment_method_code IN ('RANDOM','STRATIFIED','RULE_BASED')),
  consent_required boolean NOT NULL DEFAULT false,
  risk_tier_code varchar(12) NOT NULL CHECK (risk_tier_code IN ('LOW','MEDIUM','HIGH')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approval_request_id uuid NOT NULL REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED' CHECK (status_code IN ('PLANNED','APPROVED','RUNNING','PAUSED','COMPLETED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_at > starts_at),
  CHECK (risk_tier_code <> 'HIGH' OR consent_required)
);

CREATE TABLE governance.experiment_assignments (
  experiment_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controlled_experiment_id uuid NOT NULL REFERENCES governance.controlled_experiments(controlled_experiment_id) ON DELETE RESTRICT,
  subject_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  variant_code varchar(40) NOT NULL,
  assignment_hash char(64) NOT NULL,
  consent_record_id uuid REFERENCES governance.consent_records(consent_record_id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  withdrawn_at timestamptz,
  exclusion_reason text,
  UNIQUE (controlled_experiment_id, subject_party_id),
  CHECK (withdrawn_at IS NULL OR withdrawn_at > assigned_at)
);

CREATE VIEW governance.v_feature_release_readiness AS
SELECT f.feature_flag_id,f.flag_key,f.risk_tier_code,
       CASE
         WHEN f.status_code NOT IN ('APPROVED','ACTIVE') THEN 'FEATURE_NOT_APPROVED'
         WHEN f.expires_at <= clock_timestamp() THEN 'FEATURE_FLAG_EXPIRED'
         WHEN f.risk_tier_code IN ('HIGH','CRITICAL') AND NOT f.emergency_disable_supported THEN 'EMERGENCY_DISABLE_REQUIRED'
         WHEN NOT EXISTS (
           SELECT 1 FROM governance.feature_flag_rules r
           WHERE r.feature_flag_id=f.feature_flag_id AND r.environment_code='PRODUCTION'
             AND r.approval_request_id IS NOT NULL
             AND r.starts_at<=clock_timestamp() AND (r.ends_at IS NULL OR r.ends_at>clock_timestamp())
         ) THEN 'APPROVED_PRODUCTION_RULE_REQUIRED'
         WHEN EXISTS (
           SELECT 1 FROM governance.controlled_experiments e
           WHERE e.feature_flag_id=f.feature_flag_id AND e.status_code='RUNNING'
             AND e.risk_tier_code='HIGH' AND NOT e.consent_required
         ) THEN 'HIGH_RISK_EXPERIMENT_CONSENT_REQUIRED'
         ELSE 'READY_FOR_GOVERNED_ROLLOUT'
       END AS readiness_code
FROM governance.feature_flags f;

COMMIT;
