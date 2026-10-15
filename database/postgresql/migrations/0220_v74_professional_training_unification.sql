BEGIN;

-- Package C performs idempotent compatibility backfills. Legacy professional
-- and training tables remain authoritative until a later read cutover.

ALTER TABLE professional.experience_records
  ADD COLUMN record_type_code varchar(30)
    CHECK (record_type_code IS NULL OR record_type_code IN (
      'EMPLOYMENT', 'PROJECT', 'TRAINING', 'CONSULTING', 'RESEARCH'
    )),
  ADD COLUMN source_snapshot jsonb,
  ADD COLUMN source_schema_version integer NOT NULL DEFAULT 1
    CHECK (source_schema_version > 0),
  ADD COLUMN is_public boolean NOT NULL DEFAULT true;

CREATE TABLE integration.data_reconciliation_runs (
  data_reconciliation_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code varchar(40) NOT NULL,
  entity_family_code varchar(60) NOT NULL,
  run_type_code varchar(30) NOT NULL
    CHECK (run_type_code IN ('BACKFILL', 'VALIDATION', 'REPAIR', 'CUTOVER_CHECK')),
  status_code varchar(20) NOT NULL DEFAULT 'RUNNING'
    CHECK (status_code IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  initiated_by text NOT NULL DEFAULT current_user,
  error_summary text,
  CONSTRAINT ck_data_reconciliation_parameters
    CHECK (jsonb_typeof(parameters) = 'object'),
  CONSTRAINT ck_data_reconciliation_completion
    CHECK (status_code = 'RUNNING' OR completed_at IS NOT NULL)
);

CREATE TABLE integration.data_reconciliation_metrics (
  data_reconciliation_metric_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_reconciliation_run_id uuid NOT NULL
    REFERENCES integration.data_reconciliation_runs(data_reconciliation_run_id) ON DELETE CASCADE,
  source_entity_name varchar(120) NOT NULL,
  target_entity_name varchar(120) NOT NULL,
  source_count bigint NOT NULL CHECK (source_count >= 0),
  target_count bigint NOT NULL CHECK (target_count >= 0),
  matched_count bigint NOT NULL CHECK (matched_count >= 0),
  exception_count bigint NOT NULL CHECK (exception_count >= 0),
  checksum_sha256 char(64),
  measured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_reconciliation_counts
    CHECK (matched_count + exception_count <= source_count),
  UNIQUE (data_reconciliation_run_id, source_entity_name, target_entity_name)
);

-- Employment experience.
INSERT INTO professional.experience_records (
  professional_profile_id, record_type_code, experience_type_code, title_ar, title_en,
  organization_party_id, country_code, started_on, ended_on, role_code,
  contribution_summary_ar, outcome_summary_ar, legacy_source_table,
  legacy_source_id, source_snapshot, is_public
)
SELECT
  e.professional_profile_id,
  'EMPLOYMENT',
  e.experience_type_code,
  e.job_title_ar,
  e.job_title_en,
  e.employer_organization_party_id,
  e.country_code,
  e.started_at,
  e.ended_at,
  e.job_level_code,
  e.responsibilities_ar,
  e.outcomes_ar,
  'professional.employment_experiences',
  e.employment_experience_id,
  to_jsonb(e),
  e.is_public
FROM professional.employment_experiences e
ON CONFLICT (legacy_source_table, legacy_source_id) DO NOTHING;

-- Project experience.
INSERT INTO professional.experience_records (
  professional_profile_id, record_type_code, title_ar, title_en,
  country_code, started_on, duration_days, role_code,
  contribution_summary_ar, outcome_summary_ar, legacy_source_table,
  legacy_source_id, source_snapshot, is_public
)
SELECT
  e.professional_profile_id,
  'PROJECT',
  e.project_name_ar,
  e.project_name_en,
  e.country_code,
  make_date(e.execution_year, 1, 1),
  e.duration_days,
  e.expert_role_code,
  e.role_description_ar,
  e.verified_outcome_ar,
  'professional.project_experiences',
  e.project_experience_id,
  to_jsonb(e),
  e.is_public
FROM professional.project_experiences e
ON CONFLICT (legacy_source_table, legacy_source_id) DO NOTHING;

-- Training delivery experience.
INSERT INTO professional.experience_records (
  professional_profile_id, record_type_code, title_ar, title_en,
  organization_party_id, country_code, started_on,
  contribution_summary_ar, legacy_source_table, legacy_source_id,
  source_snapshot, is_public
)
SELECT
  e.professional_profile_id,
  'TRAINING',
  e.course_name_ar,
  e.course_name_en,
  e.training_center_party_id,
  e.country_code,
  e.delivery_date,
  concat_ws(
    ' | ',
    'المستوى: ' || e.course_level_code,
    CASE WHEN e.duration_hours IS NOT NULL THEN 'الساعات: ' || e.duration_hours::text END,
    CASE WHEN e.participant_count IS NOT NULL THEN 'المشاركون: ' || e.participant_count::text END
  ),
  'professional.training_experiences',
  e.training_experience_id,
  to_jsonb(e),
  true
FROM professional.training_experiences e
ON CONFLICT (legacy_source_table, legacy_source_id) DO NOTHING;

-- Consulting experience.
INSERT INTO professional.experience_records (
  professional_profile_id, record_type_code, title_ar, title_en,
  country_code, started_on, ended_on, duration_days,
  outcome_summary_ar, legacy_source_table, legacy_source_id,
  source_snapshot, is_public
)
SELECT
  e.professional_profile_id,
  'CONSULTING',
  e.engagement_title_ar,
  e.engagement_title_en,
  e.country_code,
  e.started_at,
  e.ended_at,
  e.duration_days,
  e.outcome_summary_ar,
  'professional.consulting_experiences',
  e.consulting_experience_id,
  to_jsonb(e),
  e.is_public
FROM professional.consulting_experiences e
ON CONFLICT (legacy_source_table, legacy_source_id) DO NOTHING;

-- Research experience.
INSERT INTO professional.experience_records (
  professional_profile_id, record_type_code, title_ar, title_en,
  organization_party_id, started_on, ended_on, role_code,
  outcome_summary_ar, legacy_source_table, legacy_source_id,
  source_snapshot, is_public
)
SELECT
  e.professional_profile_id,
  'RESEARCH',
  e.research_title_ar,
  e.research_title_en,
  e.host_organization_party_id,
  e.started_at,
  e.ended_at,
  e.research_role_code,
  e.outcome_summary_ar,
  'professional.research_experiences',
  e.research_experience_id,
  to_jsonb(e),
  e.is_public
FROM professional.research_experiences e
ON CONFLICT (legacy_source_table, legacy_source_id) DO NOTHING;

CREATE TABLE training.course_contents (
  course_content_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_code varchar(60) NOT NULL UNIQUE,
  canonical_title_ar varchar(320) NOT NULL,
  canonical_title_en varchar(320),
  normalized_title_ar varchar(320) NOT NULL,
  normalized_title_en varchar(320),
  current_content_version_id uuid,
  status_code varchar(30) NOT NULL
    CHECK (status_code IN (
      'DRAFT', 'DUPLICATE_CHECK', 'CLASSIFICATION_PENDING',
      'REVIEW_PENDING', 'APPROVED', 'PUBLISHED', 'SUSPENDED',
      'MERGED', 'ARCHIVED'
    )),
  merged_into_content_id uuid REFERENCES training.course_contents(course_content_id),
  legacy_course_id uuid UNIQUE
    REFERENCES training.courses(course_id) ON DELETE RESTRICT,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT ck_course_content_legacy_identity
    CHECK (legacy_course_id IS NULL OR course_content_id = legacy_course_id),
  CONSTRAINT ck_course_content_merge
    CHECK (
      (status_code = 'MERGED' AND merged_into_content_id IS NOT NULL
        AND merged_into_content_id <> course_content_id)
      OR (status_code <> 'MERGED' AND merged_into_content_id IS NULL)
    )
);

CREATE TRIGGER trg_course_contents_updated
BEFORE UPDATE ON training.course_contents
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE training.course_content_versions (
  course_content_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_content_id uuid NOT NULL
    REFERENCES training.course_contents(course_content_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_label varchar(60),
  description_ar text NOT NULL,
  description_en text,
  duration_hours numeric(8,2) NOT NULL CHECK (duration_hours > 0),
  course_level_code varchar(50) NOT NULL
    REFERENCES reference.course_levels(course_level_code) ON DELETE RESTRICT,
  primary_language_code varchar(12) NOT NULL
    REFERENCES reference.languages(language_code) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL
    CHECK (status_code IN (
      'DRAFT', 'REVIEW_PENDING', 'APPROVED',
      'CURRENT', 'SUPERSEDED', 'WITHDRAWN'
    )),
  content_hash char(64),
  legacy_course_version_id uuid UNIQUE
    REFERENCES training.course_versions(course_version_id) ON DELETE RESTRICT,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  approved_at timestamptz,
  CONSTRAINT ck_course_content_version_legacy_identity
    CHECK (
      legacy_course_version_id IS NULL
      OR course_content_version_id = legacy_course_version_id
    ),
  UNIQUE (course_content_id, version_no),
  UNIQUE (course_content_version_id, course_content_id)
);

CREATE UNIQUE INDEX uq_current_course_content_version
  ON training.course_content_versions (course_content_id)
  WHERE status_code = 'CURRENT';

ALTER TABLE training.course_contents
  ADD CONSTRAINT fk_course_content_current_version
  FOREIGN KEY (current_content_version_id, course_content_id)
  REFERENCES training.course_content_versions(
    course_content_version_id, course_content_id
  )
  ON DELETE RESTRICT;

CREATE TABLE training.course_content_version_names (
  course_content_version_name_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_content_version_id uuid NOT NULL
    REFERENCES training.course_content_versions(course_content_version_id) ON DELETE CASCADE,
  language_code varchar(12) NOT NULL
    REFERENCES reference.languages(language_code) ON DELETE RESTRICT,
  name_type_code varchar(30) NOT NULL
    CHECK (name_type_code IN ('PRIMARY', 'ALTERNATIVE', 'LEGACY', 'MARKETING')),
  name_value varchar(320) NOT NULL,
  normalized_value varchar(320) NOT NULL,
  legacy_course_name_id uuid UNIQUE
    REFERENCES training.course_names(course_name_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (
    course_content_version_id, language_code,
    name_type_code, normalized_value
  )
);

CREATE TABLE training.course_offering_content_links (
  course_offering_content_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL UNIQUE
    REFERENCES training.course_offerings(course_offering_id) ON DELETE CASCADE,
  course_content_version_id uuid NOT NULL
    REFERENCES training.course_content_versions(course_content_version_id) ON DELETE RESTRICT,
  legacy_course_version_id uuid
    REFERENCES training.course_versions(course_version_id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_offering_content_legacy_version
    UNIQUE (course_offering_id, legacy_course_version_id)
);

CREATE TABLE training.course_content_fingerprints (
  course_content_fingerprint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_content_id uuid NOT NULL
    REFERENCES training.course_contents(course_content_id) ON DELETE CASCADE,
  course_content_version_id uuid
    REFERENCES training.course_content_versions(course_content_version_id) ON DELETE CASCADE,
  fingerprint_type_code varchar(30) NOT NULL
    CHECK (fingerprint_type_code IN ('TITLE_TAXONOMY', 'CONTENT_HASH')),
  fingerprint_sha256 char(64) NOT NULL,
  algorithm_version varchar(30) NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (
    course_content_id, course_content_version_id,
    fingerprint_type_code, algorithm_version
  )
);

CREATE INDEX ix_course_content_fingerprint_lookup
  ON training.course_content_fingerprints
    (fingerprint_type_code, fingerprint_sha256);

CREATE TABLE training.course_content_duplicate_candidates (
  course_content_duplicate_candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_content_id uuid NOT NULL
    REFERENCES training.course_contents(course_content_id) ON DELETE CASCADE,
  existing_content_id uuid NOT NULL
    REFERENCES training.course_contents(course_content_id) ON DELETE RESTRICT,
  title_similarity numeric(6,5) NOT NULL CHECK (title_similarity BETWEEN 0 AND 1),
  taxonomy_similarity numeric(6,5) NOT NULL CHECK (taxonomy_similarity BETWEEN 0 AND 1),
  content_similarity numeric(6,5)
    CHECK (content_similarity IS NULL OR content_similarity BETWEEN 0 AND 1),
  overall_similarity numeric(6,5) NOT NULL CHECK (overall_similarity BETWEEN 0 AND 1),
  recommendation_code varchar(40) NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status_code IN (
      'PENDING_REVIEW', 'USE_EXISTING', 'CREATE_NEW_VERSION',
      'KEEP_SEPARATE', 'MERGE_APPROVED', 'REJECTED'
    )),
  legacy_candidate_id uuid UNIQUE
    REFERENCES training.course_duplicate_candidates(course_duplicate_candidate_id)
    ON DELETE RESTRICT,
  reviewed_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  rationale_ar text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_course_content_duplicate_distinct
    CHECK (proposed_content_id <> existing_content_id),
  CONSTRAINT ck_course_content_duplicate_review
    CHECK (
      status_code = 'PENDING_REVIEW'
      OR (reviewed_by_party_id IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
  UNIQUE (proposed_content_id, existing_content_id)
);

INSERT INTO training.course_contents (
  course_content_id, content_code, canonical_title_ar, canonical_title_en,
  normalized_title_ar, normalized_title_en, status_code,
  merged_into_content_id, legacy_course_id, created_by_party_id,
  created_at, updated_at, row_version
)
SELECT
  c.course_id,
  c.course_code,
  c.canonical_title_ar,
  c.canonical_title_en,
  c.normalized_title_ar,
  c.normalized_title_en,
  c.status_code,
  c.merged_into_course_id,
  c.course_id,
  c.created_by_party_id,
  c.created_at,
  c.updated_at,
  c.row_version
FROM training.courses c
ON CONFLICT (legacy_course_id) DO NOTHING;

INSERT INTO training.course_content_versions (
  course_content_version_id, course_content_id, version_no, version_label,
  description_ar, description_en, duration_hours, course_level_code,
  primary_language_code, status_code, content_hash,
  legacy_course_version_id, created_by_party_id, created_at, approved_at
)
SELECT
  v.course_version_id,
  v.course_id,
  v.version_no,
  v.version_label,
  v.description_ar,
  v.description_en,
  v.duration_hours,
  v.course_level_code,
  v.language_code,
  v.status_code,
  v.content_hash,
  v.course_version_id,
  v.created_by_party_id,
  v.created_at,
  v.approved_at
FROM training.course_versions v
ON CONFLICT (legacy_course_version_id) DO NOTHING;

UPDATE training.course_contents c
SET current_content_version_id = (
  SELECT v.course_content_version_id
  FROM training.course_content_versions v
  WHERE v.course_content_id = c.course_content_id
  ORDER BY (v.status_code = 'CURRENT') DESC, v.version_no DESC
  LIMIT 1
)
WHERE c.current_content_version_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM training.course_content_versions v
    WHERE v.course_content_id = c.course_content_id
  );

INSERT INTO training.course_content_version_names (
  course_content_version_id, language_code, name_type_code,
  name_value, normalized_value, legacy_course_name_id, created_at
)
SELECT
  c.current_content_version_id,
  n.language_code,
  n.name_type_code,
  n.name_value,
  n.normalized_value,
  n.course_name_id,
  n.created_at
FROM training.course_names n
JOIN training.course_contents c ON c.legacy_course_id = n.course_id
WHERE c.current_content_version_id IS NOT NULL
ON CONFLICT (legacy_course_name_id) DO NOTHING;

INSERT INTO training.course_offering_content_links (
  course_offering_id, course_content_version_id, legacy_course_version_id
)
SELECT
  o.course_offering_id,
  v.course_content_version_id,
  o.course_version_id
FROM training.course_offerings o
JOIN training.course_content_versions v
  ON v.legacy_course_version_id = o.course_version_id
ON CONFLICT (course_offering_id) DO NOTHING;

INSERT INTO training.course_content_duplicate_candidates (
  proposed_content_id, existing_content_id, title_similarity,
  taxonomy_similarity, content_similarity, overall_similarity,
  recommendation_code, legacy_candidate_id
)
SELECT
  d.proposed_course_id,
  d.existing_course_id,
  d.title_similarity,
  d.taxonomy_similarity,
  d.content_similarity,
  d.overall_similarity,
  d.recommendation_code,
  d.course_duplicate_candidate_id
FROM training.course_duplicate_candidates d
ON CONFLICT (legacy_candidate_id) DO NOTHING;

WITH taxonomy_signatures AS (
  SELECT
    c.course_content_id,
    c.current_content_version_id,
    c.normalized_title_ar,
    coalesce(
      string_agg(a.taxonomy_node_id::text, ',' ORDER BY a.taxonomy_node_id::text),
      ''
    ) AS taxonomy_signature
  FROM training.course_contents c
  LEFT JOIN training.course_taxonomy_assignments a
    ON a.course_id = c.legacy_course_id
  GROUP BY
    c.course_content_id, c.current_content_version_id, c.normalized_title_ar
)
INSERT INTO training.course_content_fingerprints (
  course_content_id, course_content_version_id, fingerprint_type_code,
  fingerprint_sha256, algorithm_version
)
SELECT
  course_content_id,
  current_content_version_id,
  'TITLE_TAXONOMY',
  encode(digest(normalized_title_ar || ':' || taxonomy_signature, 'sha256'), 'hex'),
  'TITLE_TAXONOMY_V1'
FROM taxonomy_signatures
ON CONFLICT (
  course_content_id, course_content_version_id,
  fingerprint_type_code, algorithm_version
) DO NOTHING;

INSERT INTO training.course_content_fingerprints (
  course_content_id, course_content_version_id, fingerprint_type_code,
  fingerprint_sha256, algorithm_version
)
SELECT
  v.course_content_id,
  v.course_content_version_id,
  'CONTENT_HASH',
  v.content_hash,
  'SOURCE_HASH_V1'
FROM training.course_content_versions v
WHERE v.content_hash IS NOT NULL
ON CONFLICT (
  course_content_id, course_content_version_id,
  fingerprint_type_code, algorithm_version
) DO NOTHING;

-- Exact fingerprints create review candidates only; they never merge content.
WITH duplicate_fingerprints AS (
  SELECT
    least(a.course_content_id, b.course_content_id) AS content_a_id,
    greatest(a.course_content_id, b.course_content_id) AS content_b_id,
    bool_or(a.fingerprint_type_code = 'CONTENT_HASH') AS same_content,
    bool_or(a.fingerprint_type_code = 'TITLE_TAXONOMY') AS same_title_taxonomy
  FROM training.course_content_fingerprints a
  JOIN training.course_content_fingerprints b
    ON b.fingerprint_type_code = a.fingerprint_type_code
   AND b.fingerprint_sha256 = a.fingerprint_sha256
   AND b.course_content_id > a.course_content_id
  GROUP BY
    least(a.course_content_id, b.course_content_id),
    greatest(a.course_content_id, b.course_content_id)
)
INSERT INTO training.course_content_duplicate_candidates (
  proposed_content_id, existing_content_id, title_similarity,
  taxonomy_similarity, content_similarity, overall_similarity,
  recommendation_code
)
SELECT
  content_b_id,
  content_a_id,
  CASE WHEN same_title_taxonomy THEN 1 ELSE 0 END,
  CASE WHEN same_title_taxonomy THEN 1 ELSE 0 END,
  CASE WHEN same_content THEN 1 ELSE NULL END,
  CASE WHEN same_content THEN 1 ELSE 0.95 END,
  CASE WHEN same_content THEN 'REVIEW_AS_SAME_CONTENT' ELSE 'REVIEW_AS_VERSION_OR_SEPARATE' END
FROM duplicate_fingerprints
ON CONFLICT (proposed_content_id, existing_content_id) DO NOTHING;

CREATE VIEW professional.v_unified_experience_records AS
SELECT
  experience_record_id,
  professional_profile_id,
  record_type_code,
  experience_type_code,
  title_ar,
  title_en,
  organization_party_id,
  country_code,
  started_on,
  ended_on,
  duration_days,
  role_code,
  contribution_summary_ar,
  outcome_summary_ar,
  is_public,
  legacy_source_table,
  legacy_source_id,
  status_code
FROM professional.experience_records
WHERE status_code <> 'ARCHIVED';

CREATE VIEW training.v_course_contents_current AS
SELECT
  c.course_content_id,
  c.content_code,
  c.canonical_title_ar,
  c.canonical_title_en,
  c.status_code AS content_status_code,
  v.course_content_version_id,
  v.version_no,
  v.version_label,
  v.description_ar,
  v.description_en,
  v.duration_hours,
  v.course_level_code,
  v.primary_language_code,
  v.status_code AS version_status_code,
  c.legacy_course_id,
  v.legacy_course_version_id
FROM training.course_contents c
LEFT JOIN training.course_content_versions v
  ON v.course_content_version_id = c.current_content_version_id;

WITH run AS (
  INSERT INTO integration.data_reconciliation_runs (
    package_code, entity_family_code, run_type_code,
    status_code, parameters, completed_at
  )
  VALUES (
    'PACKAGE_C', 'PROFESSIONAL_TRAINING', 'BACKFILL',
    'SUCCEEDED', '{"version":1,"mode":"idempotent"}'::jsonb, clock_timestamp()
  )
  RETURNING data_reconciliation_run_id
)
INSERT INTO integration.data_reconciliation_metrics (
  data_reconciliation_run_id, source_entity_name, target_entity_name,
  source_count, target_count, matched_count, exception_count
)
SELECT
  run.data_reconciliation_run_id,
  metrics.source_entity_name,
  metrics.target_entity_name,
  metrics.source_count,
  metrics.target_count,
  least(metrics.source_count, metrics.target_count),
  greatest(metrics.source_count - metrics.target_count, 0)
FROM run
CROSS JOIN LATERAL (
  VALUES
    (
      'professional.legacy_experiences',
      'professional.experience_records',
      (
        (SELECT count(*) FROM professional.employment_experiences) +
        (SELECT count(*) FROM professional.project_experiences) +
        (SELECT count(*) FROM professional.training_experiences) +
        (SELECT count(*) FROM professional.consulting_experiences) +
        (SELECT count(*) FROM professional.research_experiences)
      ),
      (
        SELECT count(*) FROM professional.experience_records
        WHERE legacy_source_table IS NOT NULL
      )
    ),
    (
      'training.courses',
      'training.course_contents',
      (SELECT count(*) FROM training.courses),
      (SELECT count(*) FROM training.course_contents)
    ),
    (
      'training.course_versions',
      'training.course_content_versions',
      (SELECT count(*) FROM training.course_versions),
      (SELECT count(*) FROM training.course_content_versions)
    ),
    (
      'training.course_offerings',
      'training.course_offering_content_links',
      (SELECT count(*) FROM training.course_offerings),
      (SELECT count(*) FROM training.course_offering_content_links)
    )
) AS metrics (
  source_entity_name, target_entity_name, source_count, target_count
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0220_v74_professional_training_unification')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
