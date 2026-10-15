BEGIN;

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.metric_definitions (
  metric_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  business_purpose text NOT NULL,
  domain_code varchar(30) NOT NULL CHECK (domain_code IN ('MEMBERSHIP','DIRECTORY','MATCHING','TRAINING','SERVICE_DELIVERY','FINANCE','QUALITY','KNOWLEDGE','PLATFORM','RISK')),
  metric_kind_code varchar(20) NOT NULL CHECK (metric_kind_code IN ('COUNT','RATIO','PERCENTAGE','DURATION','AMOUNT','SCORE','INDEX')),
  unit_code varchar(24) NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  steward_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  data_product_id uuid NOT NULL REFERENCES quality.data_products(data_product_id) ON DELETE RESTRICT,
  sensitivity_code varchar(20) NOT NULL CHECK (sensitivity_code IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status_code IN ('DRAFT','REVIEW','APPROVED','ACTIVE','DEPRECATED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (owner_party_id <> steward_party_id)
);

CREATE TABLE analytics.metric_definition_versions (
  metric_definition_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES analytics.metric_definitions(metric_definition_id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number > 0),
  formula_text text NOT NULL,
  numerator_definition text,
  denominator_definition text,
  inclusion_rules jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(inclusion_rules) = 'array'),
  exclusion_rules jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exclusion_rules) = 'array'),
  aggregation_code varchar(20) NOT NULL CHECK (aggregation_code IN ('SUM','COUNT','DISTINCT_COUNT','AVERAGE','MEDIAN','MINIMUM','MAXIMUM','WEIGHTED','CUSTOM')),
  reporting_grain varchar(120) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  change_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (metric_definition_id, version_number),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (approved_at IS NULL OR approved_by_party_id IS NOT NULL)
);

CREATE TABLE analytics.metric_dimensions (
  metric_dimension_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES analytics.metric_definitions(metric_definition_id) ON DELETE RESTRICT,
  dimension_code varchar(60) NOT NULL,
  dimension_name_ar varchar(160) NOT NULL,
  catalog_field_id uuid REFERENCES quality.data_catalog_fields(data_catalog_field_id) ON DELETE RESTRICT,
  allowed_values_reference text,
  public_breakdown_allowed boolean NOT NULL DEFAULT false,
  minimum_group_size integer NOT NULL DEFAULT 10 CHECK (minimum_group_size > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (metric_definition_id, dimension_code)
);

CREATE TABLE analytics.metric_observations (
  metric_observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_version_id uuid NOT NULL REFERENCES analytics.metric_definition_versions(metric_definition_version_id) ON DELETE RESTRICT,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  dimension_values jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(dimension_values) = 'object'),
  numeric_value numeric(24,8) NOT NULL,
  sample_size bigint CHECK (sample_size IS NULL OR sample_size >= 0),
  quality_run_id uuid REFERENCES quality.data_quality_runs(data_quality_run_id) ON DELETE RESTRICT,
  calculation_reference text NOT NULL,
  calculation_hash char(64) NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  freshness_expires_at timestamptz NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  CHECK (period_end > period_start),
  CHECK (freshness_expires_at > calculated_at)
);

CREATE TABLE analytics.report_definitions (
  report_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  audience_code varchar(24) NOT NULL CHECK (audience_code IN ('PUBLIC','MEMBER','CLIENT','ORGANIZATION','OPERATOR','ADMIN','BOARD','INVESTOR')),
  purpose_text text NOT NULL,
  metric_definition_ids jsonb NOT NULL CHECK (jsonb_typeof(metric_definition_ids) = 'array'),
  layout_definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(layout_definition) = 'object'),
  privacy_review_required boolean NOT NULL DEFAULT true,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status_code IN ('DRAFT','REVIEW','APPROVED','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (metric_definition_ids <> '[]'::jsonb)
);

CREATE TABLE analytics.report_runs (
  report_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_definition_id uuid NOT NULL REFERENCES analytics.report_definitions(report_definition_id) ON DELETE RESTRICT,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  parameter_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(parameter_snapshot) = 'object'),
  metric_observation_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(metric_observation_ids) = 'array'),
  status_code varchar(20) NOT NULL DEFAULT 'QUEUED' CHECK (status_code IN ('QUEUED','RUNNING','VALIDATING','PUBLISHED','FAILED','WITHDRAWN','EXPIRED')),
  output_reference text,
  output_hash char(64),
  started_at timestamptz,
  completed_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (completed_at IS NULL OR started_at IS NOT NULL),
  CHECK (published_at IS NULL OR (completed_at IS NOT NULL AND output_reference IS NOT NULL AND output_hash IS NOT NULL)),
  CHECK (status_code <> 'PUBLISHED' OR metric_observation_ids <> '[]'::jsonb),
  CHECK (status_code <> 'FAILED' OR failure_reason IS NOT NULL),
  CHECK (expires_at IS NULL OR published_at IS NOT NULL)
);

CREATE VIEW analytics.v_report_publication_readiness AS
SELECT r.report_run_id,
       d.report_code,
       d.audience_code,
       CASE
         WHEN d.status_code <> 'ACTIVE' THEN 'REPORT_DEFINITION_NOT_ACTIVE'
         WHEN r.status_code <> 'PUBLISHED' THEN 'REPORT_RUN_NOT_PUBLISHED'
         WHEN r.expires_at IS NOT NULL AND r.expires_at <= clock_timestamp() THEN 'REPORT_EXPIRED'
         WHEN EXISTS (
           SELECT 1 FROM analytics.metric_observations o
           WHERE o.metric_observation_id::text IN (SELECT jsonb_array_elements_text(r.metric_observation_ids))
             AND o.freshness_expires_at <= clock_timestamp()
         ) THEN 'STALE_METRIC_OBSERVATION'
         WHEN d.audience_code = 'PUBLIC' AND EXISTS (
           SELECT 1 FROM analytics.metric_definitions m
           WHERE m.metric_definition_id::text IN (SELECT jsonb_array_elements_text(d.metric_definition_ids))
             AND m.sensitivity_code <> 'PUBLIC'
         ) THEN 'PUBLIC_SENSITIVITY_VIOLATION'
         WHEN EXISTS (
           SELECT 1 FROM analytics.metric_observations o
           WHERE o.metric_observation_id::text IN (SELECT jsonb_array_elements_text(r.metric_observation_ids))
             AND o.is_synthetic
         ) THEN 'SYNTHETIC_DATA_DISCLOSURE_REQUIRED'
         ELSE 'READY_FOR_PRESENTATION'
       END AS readiness_code
FROM analytics.report_runs r
JOIN analytics.report_definitions d ON d.report_definition_id = r.report_definition_id;

COMMIT;
