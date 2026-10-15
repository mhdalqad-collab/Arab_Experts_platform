BEGIN;

-- Package D creates canonical compatibility copies for contracts, rights, and
-- quality. Existing finance/evidence tables remain authoritative. Identifiers
-- are preserved so a later cutover can be verified without identity remapping.

CREATE TABLE contract.contract_records (
  contract_id uuid PRIMARY KEY,
  contract_number varchar(50) NOT NULL UNIQUE,
  engagement_id uuid REFERENCES delivery.engagements(engagement_id) ON DELETE RESTRICT,
  service_request_id uuid REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  contract_type_code varchar(50) NOT NULL,
  title_ar varchar(320) NOT NULL,
  title_en varchar(320),
  governing_country_code char(2) REFERENCES reference.countries(country_code) ON DELETE RESTRICT,
  governing_law_text text,
  start_date date,
  end_date date,
  total_value numeric(18,3) CHECK (total_value IS NULL OR total_value >= 0),
  currency_code char(3) REFERENCES reference.currencies(currency_code) ON DELETE RESTRICT,
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code) ON DELETE RESTRICT,
  status_code varchar(30) NOT NULL,
  current_version_no integer NOT NULL CHECK (current_version_no > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  activated_at timestamptz,
  terminated_at timestamptz,
  termination_reason text,
  legacy_source_table varchar(80) NOT NULL DEFAULT 'finance.contracts',
  legacy_source_id uuid NOT NULL UNIQUE,
  source_snapshot jsonb NOT NULL,
  source_schema_version integer NOT NULL DEFAULT 1 CHECK (source_schema_version > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT ck_contract_record_legacy_identity CHECK (contract_id = legacy_source_id),
  CONSTRAINT ck_contract_record_period CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  ),
  CONSTRAINT ck_contract_record_value_currency CHECK (
    total_value IS NULL OR currency_code IS NOT NULL
  ),
  CONSTRAINT ck_contract_record_source CHECK (
    engagement_id IS NOT NULL OR service_request_id IS NOT NULL
  )
);

CREATE INDEX ix_contract_records_status_dates
  ON contract.contract_records(status_code, start_date, end_date);

CREATE TRIGGER trg_contract_records_updated
BEFORE UPDATE ON contract.contract_records
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE rights.intellectual_assets (
  intellectual_asset_id uuid PRIMARY KEY,
  asset_code varchar(60) NOT NULL UNIQUE,
  asset_type_code varchar(50) NOT NULL,
  title_ar varchar(320) NOT NULL,
  title_en varchar(320),
  description_ar text,
  source_entity_type varchar(80),
  source_entity_id uuid,
  creation_date date,
  registration_number varchar(140),
  registration_country_code char(2)
    REFERENCES reference.countries(country_code) ON DELETE RESTRICT,
  protection_status_code varchar(30) NOT NULL,
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code) ON DELETE RESTRICT,
  current_version_no integer NOT NULL CHECK (current_version_no > 0),
  legacy_source_table varchar(80) NOT NULL DEFAULT 'finance.ip_assets',
  legacy_source_id uuid NOT NULL UNIQUE,
  source_snapshot jsonb NOT NULL,
  source_schema_version integer NOT NULL DEFAULT 1 CHECK (source_schema_version > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT ck_intellectual_asset_legacy_identity
    CHECK (intellectual_asset_id = legacy_source_id)
);

CREATE INDEX ix_intellectual_assets_source
  ON rights.intellectual_assets(source_entity_type, source_entity_id);

CREATE TRIGGER trg_intellectual_assets_updated
BEFORE UPDATE ON rights.intellectual_assets
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE quality.evaluations (
  evaluation_id uuid PRIMARY KEY,
  rated_entity_type varchar(80) NOT NULL,
  rated_entity_id uuid NOT NULL,
  rater_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  source_transaction_type varchar(80) NOT NULL,
  source_transaction_id uuid NOT NULL,
  overall_rating numeric(3,2) NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  review_text text,
  status_code varchar(30) NOT NULL,
  submitted_at timestamptz NOT NULL,
  published_at timestamptz,
  legacy_source_table varchar(80) NOT NULL DEFAULT 'evidence.ratings',
  legacy_source_id uuid NOT NULL UNIQUE,
  source_snapshot jsonb NOT NULL,
  source_schema_version integer NOT NULL DEFAULT 1 CHECK (source_schema_version > 0),
  CONSTRAINT ck_evaluation_legacy_identity CHECK (evaluation_id = legacy_source_id),
  UNIQUE (
    rater_party_id, source_transaction_type, source_transaction_id,
    rated_entity_type, rated_entity_id
  )
);

CREATE INDEX ix_quality_evaluations_target
  ON quality.evaluations(rated_entity_type, rated_entity_id, submitted_at DESC);

CREATE TABLE quality.complaint_cases (
  complaint_case_id uuid PRIMARY KEY,
  complaint_number varchar(40) NOT NULL UNIQUE,
  complainant_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  respondent_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  target_entity_type varchar(80),
  target_entity_id uuid,
  complaint_type_code varchar(50) NOT NULL,
  subject_ar varchar(260) NOT NULL,
  description_ar text NOT NULL,
  status_code varchar(30) NOT NULL,
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code) ON DELETE RESTRICT,
  submitted_at timestamptz,
  resolved_at timestamptz,
  legacy_source_table varchar(80) NOT NULL DEFAULT 'evidence.complaints',
  legacy_source_id uuid NOT NULL UNIQUE,
  source_snapshot jsonb NOT NULL,
  source_schema_version integer NOT NULL DEFAULT 1 CHECK (source_schema_version > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT ck_complaint_case_legacy_identity CHECK (complaint_case_id = legacy_source_id)
);

CREATE INDEX ix_quality_complaint_cases_status
  ON quality.complaint_cases(status_code, submitted_at);

CREATE TRIGGER trg_quality_complaint_cases_updated
BEFORE UPDATE ON quality.complaint_cases
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE quality.reputation_profiles (
  reputation_profile_id uuid PRIMARY KEY,
  target_entity_type varchar(80) NOT NULL,
  target_entity_id uuid NOT NULL,
  average_rating numeric(3,2)
    CHECK (average_rating IS NULL OR average_rating BETWEEN 1 AND 5),
  rating_count integer NOT NULL CHECK (rating_count >= 0),
  quality_score numeric(6,5)
    CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 1),
  complaint_adjustment numeric(6,5) NOT NULL
    CHECK (complaint_adjustment BETWEEN 0 AND 1),
  reputation_model_version_id uuid
    REFERENCES quality.reputation_model_versions(reputation_model_version_id) ON DELETE RESTRICT,
  calculated_at timestamptz NOT NULL,
  calculation_snapshot jsonb NOT NULL,
  legacy_source_table varchar(80) NOT NULL DEFAULT 'evidence.reputation_profiles',
  legacy_source_id uuid NOT NULL UNIQUE,
  source_snapshot jsonb NOT NULL,
  source_schema_version integer NOT NULL DEFAULT 1 CHECK (source_schema_version > 0),
  CONSTRAINT ck_quality_reputation_legacy_identity
    CHECK (reputation_profile_id = legacy_source_id),
  UNIQUE (target_entity_type, target_entity_id)
);

INSERT INTO contract.contract_records (
  contract_id, contract_number, engagement_id, service_request_id,
  contract_type_code, title_ar, title_en, governing_country_code,
  governing_law_text, start_date, end_date, total_value, currency_code,
  confidentiality_level_code, status_code, current_version_no,
  created_by_party_id, activated_at, terminated_at, termination_reason,
  legacy_source_id, source_snapshot, row_version, created_at, updated_at
)
SELECT
  c.contract_id, c.contract_number, c.engagement_id, c.service_request_id,
  c.contract_type_code, c.title_ar, c.title_en, c.governing_country_code,
  c.governing_law_text, c.start_date, c.end_date, c.total_value, c.currency_code,
  c.confidentiality_level_code, c.status_code, c.current_version_no,
  c.created_by_party_id, c.activated_at, c.terminated_at, c.termination_reason,
  c.contract_id, to_jsonb(c), c.row_version, c.created_at, c.updated_at
FROM finance.contracts c
ON CONFLICT (legacy_source_id) DO NOTHING;

INSERT INTO rights.intellectual_assets (
  intellectual_asset_id, asset_code, asset_type_code, title_ar, title_en,
  description_ar, source_entity_type, source_entity_id, creation_date,
  registration_number, registration_country_code, protection_status_code,
  confidentiality_level_code, current_version_no, legacy_source_id,
  source_snapshot, created_at, updated_at
)
SELECT
  a.ip_asset_id, a.asset_code, a.asset_type_code, a.title_ar, a.title_en,
  a.description_ar, a.source_entity_type, a.source_entity_id, a.creation_date,
  a.registration_number, a.registration_country_code, a.protection_status_code,
  a.confidentiality_level_code, a.current_version_no, a.ip_asset_id,
  to_jsonb(a), a.created_at, a.updated_at
FROM finance.ip_assets a
ON CONFLICT (legacy_source_id) DO NOTHING;

INSERT INTO quality.evaluations (
  evaluation_id, rated_entity_type, rated_entity_id, rater_party_id,
  source_transaction_type, source_transaction_id, overall_rating, review_text,
  status_code, submitted_at, published_at, legacy_source_id, source_snapshot
)
SELECT
  r.rating_id, r.rated_entity_type, r.rated_entity_id, r.rater_party_id,
  r.source_transaction_type, r.source_transaction_id, r.overall_rating,
  r.review_text, r.status_code, r.submitted_at, r.published_at,
  r.rating_id, to_jsonb(r)
FROM evidence.ratings r
ON CONFLICT (legacy_source_id) DO NOTHING;

INSERT INTO quality.complaint_cases (
  complaint_case_id, complaint_number, complainant_party_id,
  respondent_party_id, target_entity_type, target_entity_id,
  complaint_type_code, subject_ar, description_ar, status_code,
  confidentiality_level_code, submitted_at, resolved_at, legacy_source_id,
  source_snapshot, row_version, created_at, updated_at
)
SELECT
  c.complaint_id, c.complaint_number, c.complainant_party_id,
  c.respondent_party_id, c.target_entity_type, c.target_entity_id,
  c.complaint_type_code, c.subject_ar, c.description_ar, c.status_code,
  c.confidentiality_level_code, c.submitted_at, c.resolved_at, c.complaint_id,
  to_jsonb(c), c.row_version, c.created_at, c.updated_at
FROM evidence.complaints c
ON CONFLICT (legacy_source_id) DO NOTHING;

INSERT INTO quality.reputation_profiles (
  reputation_profile_id, target_entity_type, target_entity_id, average_rating,
  rating_count, quality_score, complaint_adjustment, calculated_at,
  calculation_snapshot, legacy_source_id, source_snapshot
)
SELECT
  r.reputation_profile_id, r.target_entity_type, r.target_entity_id,
  r.average_rating, r.rating_count, r.quality_score, r.complaint_adjustment,
  r.calculated_at, r.calculation_snapshot, r.reputation_profile_id, to_jsonb(r)
FROM evidence.reputation_profiles r
ON CONFLICT (legacy_source_id) DO NOTHING;

-- Compatibility views expose complete aggregates while writes remain on legacy
-- tables. They are intentionally read-only at the application boundary.
CREATE VIEW contract.v_contracts_current AS
SELECT
  c.*,
  (
    SELECT count(*)::integer
    FROM finance.contract_parties p
    WHERE p.contract_id = c.contract_id
  ) AS party_count,
  (
    SELECT count(*)::integer
    FROM finance.contract_signatures s
    WHERE s.contract_id = c.contract_id
      AND s.signature_status_code = 'SIGNED'
  ) AS completed_signature_count
FROM contract.contract_records c;

CREATE VIEW contract.v_contract_parties_compat AS
SELECT p.* FROM finance.contract_parties p;

CREATE VIEW contract.v_contract_versions_compat AS
SELECT v.* FROM finance.contract_versions v;

CREATE VIEW contract.v_contract_signatures_compat AS
SELECT s.* FROM finance.contract_signatures s;

CREATE VIEW rights.v_intellectual_assets_current AS
SELECT
  a.*,
  (
    SELECT count(*)::integer
    FROM finance.ip_owners o
    WHERE o.ip_asset_id = a.intellectual_asset_id
      AND (o.effective_to IS NULL OR o.effective_to >= CURRENT_DATE)
  ) AS active_owner_count,
  (
    SELECT count(*)::integer
    FROM finance.ip_licenses l
    WHERE l.ip_asset_id = a.intellectual_asset_id
      AND l.status_code = 'ACTIVE'
  ) AS active_license_count
FROM rights.intellectual_assets a;

CREATE VIEW rights.v_ip_owners_compat AS
SELECT o.* FROM finance.ip_owners o;

CREATE VIEW rights.v_ip_licenses_compat AS
SELECT l.* FROM finance.ip_licenses l;

CREATE VIEW rights.v_confidentiality_agreements_compat AS
SELECT a.* FROM finance.confidentiality_agreements a;

CREATE VIEW quality.v_evaluations_current AS
SELECT
  e.*,
  (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'dimension_code', d.dimension_code,
          'rating_value', r.rating_value,
          'comment', r.comment
        )
        ORDER BY d.dimension_code
      ),
      '[]'::jsonb
    )
    FROM evidence.rating_responses r
    JOIN evidence.rating_dimensions d
      ON d.rating_dimension_id = r.rating_dimension_id
    WHERE r.rating_id = e.evaluation_id
  ) AS dimension_responses
FROM quality.evaluations e;

CREATE VIEW quality.v_complaint_cases_current AS
SELECT
  c.*,
  (
    SELECT count(*)::integer
    FROM evidence.complaint_evidence e
    WHERE e.complaint_id = c.complaint_case_id
  ) AS evidence_count,
  (
    SELECT d.decision_code
    FROM evidence.complaint_decisions d
    WHERE d.complaint_id = c.complaint_case_id
    ORDER BY d.decided_at DESC
    LIMIT 1
  ) AS latest_decision_code
FROM quality.complaint_cases c;

CREATE VIEW quality.v_reputation_profiles_current AS
SELECT
  r.*,
  m.model_code AS reputation_model_code,
  m.version_no AS reputation_model_version_no
FROM quality.reputation_profiles r
LEFT JOIN quality.reputation_model_versions m
  ON m.reputation_model_version_id = r.reputation_model_version_id;

-- Reconciliation is recorded as evidence, not inferred from successful inserts.
WITH run AS (
  INSERT INTO integration.data_reconciliation_runs (
    package_code, entity_family_code, run_type_code,
    status_code, completed_at, parameters
  )
  VALUES (
    'PACKAGE_D_V75', 'CONTRACT_RIGHTS_QUALITY', 'BACKFILL',
    'SUCCEEDED', clock_timestamp(),
    '{"authority":"legacy","identifier_strategy":"preserve","write_cutover":false}'::jsonb
  )
  RETURNING data_reconciliation_run_id
)
INSERT INTO integration.data_reconciliation_metrics (
  data_reconciliation_run_id, source_entity_name, target_entity_name,
  source_count, target_count, matched_count, exception_count
)
SELECT
  run.data_reconciliation_run_id,
  metric.source_entity_name,
  metric.target_entity_name,
  metric.source_count,
  metric.target_count,
  metric.matched_count,
  metric.source_count - metric.matched_count
FROM run
CROSS JOIN LATERAL (
  SELECT
    'finance.contracts'::varchar(120) AS source_entity_name,
    'contract.contract_records'::varchar(120) AS target_entity_name,
    (SELECT count(*) FROM finance.contracts) AS source_count,
    (SELECT count(*) FROM contract.contract_records) AS target_count,
    (
      SELECT count(*)
      FROM finance.contracts s
      JOIN contract.contract_records t ON t.legacy_source_id = s.contract_id
    ) AS matched_count
  UNION ALL
  SELECT
    'finance.ip_assets', 'rights.intellectual_assets',
    (SELECT count(*) FROM finance.ip_assets),
    (SELECT count(*) FROM rights.intellectual_assets),
    (
      SELECT count(*)
      FROM finance.ip_assets s
      JOIN rights.intellectual_assets t ON t.legacy_source_id = s.ip_asset_id
    )
  UNION ALL
  SELECT
    'evidence.ratings', 'quality.evaluations',
    (SELECT count(*) FROM evidence.ratings),
    (SELECT count(*) FROM quality.evaluations),
    (
      SELECT count(*)
      FROM evidence.ratings s
      JOIN quality.evaluations t ON t.legacy_source_id = s.rating_id
    )
  UNION ALL
  SELECT
    'evidence.complaints', 'quality.complaint_cases',
    (SELECT count(*) FROM evidence.complaints),
    (SELECT count(*) FROM quality.complaint_cases),
    (
      SELECT count(*)
      FROM evidence.complaints s
      JOIN quality.complaint_cases t ON t.legacy_source_id = s.complaint_id
    )
  UNION ALL
  SELECT
    'evidence.reputation_profiles', 'quality.reputation_profiles',
    (SELECT count(*) FROM evidence.reputation_profiles),
    (SELECT count(*) FROM quality.reputation_profiles),
    (
      SELECT count(*)
      FROM evidence.reputation_profiles s
      JOIN quality.reputation_profiles t
        ON t.legacy_source_id = s.reputation_profile_id
    )
) metric;

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0230_v75_contract_rights_quality_unification')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
