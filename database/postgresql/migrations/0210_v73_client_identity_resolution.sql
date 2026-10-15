BEGIN;

-- Package B adds identity-resolution and compatibility structures. It never
-- merges, archives, or deletes an existing Party or CRM record.

CREATE OR REPLACE FUNCTION core.normalize_match_text(input_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(lower(btrim(input_value)), '[[:punct:][:space:]]+', '', 'g'),
      '[ـ]+', '', 'g'
    ),
    ''
  );
$$;

CREATE TABLE core.party_match_keys (
  party_match_key_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE CASCADE,
  key_type_code varchar(40) NOT NULL
    CHECK (key_type_code IN (
      'REGISTRATION_NUMBER', 'TAX_NUMBER', 'VERIFIED_EMAIL',
      'VERIFIED_PHONE', 'LEGAL_NAME_COUNTRY'
    )),
  key_hash_sha256 char(64) NOT NULL,
  value_hint varchar(24),
  issuing_country_code char(2)
    REFERENCES reference.countries(country_code) ON DELETE RESTRICT,
  source_entity_type varchar(80) NOT NULL,
  source_entity_id uuid NOT NULL,
  strength_code varchar(20) NOT NULL
    CHECK (strength_code IN ('DETERMINISTIC', 'STRONG', 'SUPPORTING')),
  is_active boolean NOT NULL DEFAULT true,
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (party_id, key_type_code, key_hash_sha256, source_entity_type, source_entity_id)
);

CREATE INDEX ix_party_match_keys_lookup
  ON core.party_match_keys (key_type_code, key_hash_sha256)
  WHERE is_active;

CREATE TABLE core.party_duplicate_candidates (
  party_duplicate_candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  party_b_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  candidate_type_code varchar(30) NOT NULL
    CHECK (candidate_type_code IN ('EXACT_KEY', 'COMPOSITE', 'FUZZY_REVIEW')),
  match_score numeric(5,4) NOT NULL CHECK (match_score BETWEEN 0 AND 1),
  matched_key_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation_ar text NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status_code IN (
      'PENDING_REVIEW', 'UNDER_REVIEW', 'CONFIRMED_DUPLICATE',
      'NOT_DUPLICATE', 'DEFERRED', 'SUPERSEDED'
    )),
  detection_run_id uuid NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_duplicate_candidate_distinct
    CHECK (party_a_id <> party_b_id),
  CONSTRAINT ck_duplicate_candidate_order
    CHECK (party_a_id < party_b_id),
  CONSTRAINT ck_duplicate_candidate_key_types
    CHECK (jsonb_typeof(matched_key_types) = 'array'),
  CONSTRAINT ck_duplicate_candidate_resolution
    CHECK (
      status_code IN ('PENDING_REVIEW', 'UNDER_REVIEW')
      OR resolved_at IS NOT NULL
    ),
  UNIQUE (party_a_id, party_b_id)
);

CREATE INDEX ix_party_duplicate_review_queue
  ON core.party_duplicate_candidates (status_code, match_score DESC, detected_at)
  WHERE status_code IN ('PENDING_REVIEW', 'UNDER_REVIEW');

CREATE TRIGGER trg_party_duplicate_candidates_updated
BEFORE UPDATE ON core.party_duplicate_candidates
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE core.party_merge_reviews (
  party_merge_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_duplicate_candidate_id uuid NOT NULL
    REFERENCES core.party_duplicate_candidates(party_duplicate_candidate_id) ON DELETE RESTRICT,
  reviewer_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  review_stage_code varchar(30) NOT NULL
    CHECK (review_stage_code IN ('IDENTITY', 'DATA_STEWARD', 'FINAL_APPROVAL')),
  decision_code varchar(30) NOT NULL
    CHECK (decision_code IN (
      'REQUEST_MORE_EVIDENCE', 'CONFIRM_DUPLICATE',
      'REJECT_DUPLICATE', 'DEFER'
    )),
  canonical_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  rationale_ar text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_merge_review_canonical
    CHECK (
      decision_code <> 'CONFIRM_DUPLICATE'
      OR canonical_party_id IS NOT NULL
    ),
  UNIQUE (party_duplicate_candidate_id, review_stage_code, reviewer_party_id)
);

CREATE TABLE core.party_merge_field_decisions (
  party_merge_field_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_merge_review_id uuid NOT NULL
    REFERENCES core.party_merge_reviews(party_merge_review_id) ON DELETE CASCADE,
  field_path varchar(180) NOT NULL,
  source_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  decision_code varchar(30) NOT NULL
    CHECK (decision_code IN ('KEEP_CANONICAL', 'TAKE_SOURCE', 'KEEP_BOTH', 'MANUAL_VALUE')),
  manual_value jsonb,
  rationale_ar text,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_merge_field_manual_value
    CHECK (
      decision_code <> 'MANUAL_VALUE'
      OR manual_value IS NOT NULL
    ),
  UNIQUE (party_merge_review_id, field_path)
);

CREATE TABLE core.party_merge_plans (
  party_merge_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_duplicate_candidate_id uuid NOT NULL UNIQUE
    REFERENCES core.party_duplicate_candidates(party_duplicate_candidate_id) ON DELETE RESTRICT,
  canonical_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  duplicate_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  plan_snapshot jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'READY', 'APPROVED', 'EXECUTED', 'CANCELLED')),
  approved_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_merge_plan_distinct
    CHECK (canonical_party_id <> duplicate_party_id),
  CONSTRAINT ck_merge_plan_snapshot
    CHECK (jsonb_typeof(plan_snapshot) = 'object'),
  CONSTRAINT ck_merge_plan_approval
    CHECK (
      status_code IN ('DRAFT', 'CANCELLED')
      OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL)
    ),
  CONSTRAINT ck_merge_plan_execution
    CHECK (status_code <> 'EXECUTED' OR executed_at IS NOT NULL)
);

CREATE TABLE core.party_merge_events (
  party_merge_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_merge_plan_id uuid NOT NULL
    REFERENCES core.party_merge_plans(party_merge_plan_id) ON DELETE RESTRICT,
  event_type_code varchar(40) NOT NULL,
  entity_type varchar(80),
  entity_id uuid,
  before_snapshot jsonb,
  after_snapshot jsonb,
  correlation_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT
);

CREATE INDEX ix_party_merge_events_plan_time
  ON core.party_merge_events (party_merge_plan_id, occurred_at);

CREATE TABLE crm.client_identity_links (
  client_identity_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL UNIQUE
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  source_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  canonical_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  resolution_status_code varchar(30) NOT NULL DEFAULT 'UNCHANGED'
    CHECK (resolution_status_code IN (
      'UNCHANGED', 'PENDING_REVIEW', 'CANONICAL_CONFIRMED', 'MERGE_PLANNED'
    )),
  party_merge_plan_id uuid REFERENCES core.party_merge_plans(party_merge_plan_id) ON DELETE RESTRICT,
  resolved_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_client_identity_resolution
    CHECK (
      resolution_status_code IN ('UNCHANGED', 'PENDING_REVIEW')
      OR (resolved_by_party_id IS NOT NULL AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX ix_client_identity_links_canonical
  ON crm.client_identity_links (canonical_party_id);

CREATE TRIGGER trg_client_identity_links_updated
BEFORE UPDATE ON crm.client_identity_links
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE crm.client_contact_roles (
  client_contact_role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  person_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  organization_party_id uuid REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  role_code varchar(50) NOT NULL,
  job_title_ar varchar(180),
  authority_scope_code varchar(50),
  is_authorized_representative boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  preferred_contact_method_code varchar(40)
    REFERENCES reference.contact_method_types(contact_method_type_code) ON DELETE RESTRICT,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  legacy_client_contact_id uuid UNIQUE
    REFERENCES crm.client_contacts(client_contact_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_client_contact_role_period
    CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (client_account_id, person_party_id, role_code, valid_from)
);

CREATE UNIQUE INDEX uq_primary_client_contact_role
  ON crm.client_contact_roles (client_account_id)
  WHERE is_primary AND valid_to IS NULL;

CREATE TABLE crm.client_identity_resolution_runs (
  client_identity_resolution_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type_code varchar(30) NOT NULL
    CHECK (run_type_code IN ('KEY_REFRESH', 'CANDIDATE_DETECTION', 'BACKFILL', 'VALIDATION')),
  status_code varchar(20) NOT NULL DEFAULT 'RUNNING'
    CHECK (status_code IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  records_scanned bigint NOT NULL DEFAULT 0 CHECK (records_scanned >= 0),
  records_created bigint NOT NULL DEFAULT 0 CHECK (records_created >= 0),
  records_skipped bigint NOT NULL DEFAULT 0 CHECK (records_skipped >= 0),
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  initiated_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  CONSTRAINT ck_identity_run_parameters CHECK (jsonb_typeof(parameters) = 'object'),
  CONSTRAINT ck_identity_run_completion
    CHECK (status_code = 'RUNNING' OR completed_at IS NOT NULL)
);

ALTER TABLE core.party_duplicate_candidates
  ADD CONSTRAINT fk_party_duplicate_detection_run
  FOREIGN KEY (detection_run_id)
  REFERENCES crm.client_identity_resolution_runs(client_identity_resolution_run_id)
  ON DELETE RESTRICT;

-- Initial client identity links are a compatibility backfill only; the source
-- and canonical identities remain identical until a reviewed merge is approved.
INSERT INTO crm.client_identity_links (
  client_account_id,
  source_party_id,
  canonical_party_id,
  resolution_status_code
)
SELECT
  client_account_id,
  client_party_id,
  client_party_id,
  'UNCHANGED'
FROM crm.client_accounts
ON CONFLICT (client_account_id) DO NOTHING;

-- Contact roles preserve the former contact identifier for traceability.
INSERT INTO crm.client_contact_roles (
  client_account_id,
  person_party_id,
  organization_party_id,
  role_code,
  job_title_ar,
  is_authorized_representative,
  is_primary,
  valid_from,
  valid_to,
  legacy_client_contact_id
)
SELECT
  cc.client_account_id,
  cc.person_party_id,
  co.organization_party_id,
  cc.contact_role_code,
  cc.job_title_ar,
  cc.is_authorized_representative,
  cc.is_primary,
  cc.valid_from,
  cc.valid_to,
  cc.client_contact_id
FROM crm.client_contacts cc
LEFT JOIN crm.client_organizations co
  ON co.client_account_id = cc.client_account_id
ON CONFLICT (legacy_client_contact_id) DO NOTHING;

-- Deterministic organization registration keys.
INSERT INTO core.party_match_keys (
  party_id,
  key_type_code,
  key_hash_sha256,
  value_hint,
  issuing_country_code,
  source_entity_type,
  source_entity_id,
  strength_code
)
SELECT
  o.party_id,
  'REGISTRATION_NUMBER',
  encode(digest(
    coalesce(o.registration_country_code, '') || ':' ||
    core.normalize_match_text(o.registration_number),
    'sha256'
  ), 'hex'),
  right(o.registration_number, 4),
  o.registration_country_code,
  'core.organizations',
  o.party_id,
  'DETERMINISTIC'
FROM core.organizations o
WHERE core.normalize_match_text(o.registration_number) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verified contact keys; values are hashed and only a short hint is retained.
INSERT INTO core.party_match_keys (
  party_id,
  key_type_code,
  key_hash_sha256,
  value_hint,
  source_entity_type,
  source_entity_id,
  strength_code
)
SELECT
  pc.party_id,
  CASE
    WHEN pc.contact_method_type_code = 'EMAIL' THEN 'VERIFIED_EMAIL'
    ELSE 'VERIFIED_PHONE'
  END,
  encode(digest(core.normalize_match_text(pc.normalized_value), 'sha256'), 'hex'),
  right(pc.normalized_value, 4),
  'core.party_contacts',
  pc.party_contact_id,
  'STRONG'
FROM core.party_contacts pc
WHERE pc.is_verified
  AND pc.valid_to IS NULL
  AND pc.contact_method_type_code IN ('EMAIL', 'PHONE', 'MOBILE')
  AND core.normalize_match_text(pc.normalized_value) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Legal-name and country keys support review but never authorize automatic merge.
INSERT INTO core.party_match_keys (
  party_id,
  key_type_code,
  key_hash_sha256,
  value_hint,
  issuing_country_code,
  source_entity_type,
  source_entity_id,
  strength_code
)
SELECT
  o.party_id,
  'LEGAL_NAME_COUNTRY',
  encode(digest(
    coalesce(o.registration_country_code, '') || ':' ||
    core.normalize_match_text(o.legal_name_ar),
    'sha256'
  ), 'hex'),
  left(core.normalize_match_text(o.legal_name_ar), 12),
  o.registration_country_code,
  'core.organizations',
  o.party_id,
  'SUPPORTING'
FROM core.organizations o
WHERE core.normalize_match_text(o.legal_name_ar) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Candidate creation is idempotent and requires human review. Exact contact or
-- registration matches receive a higher score than name/country matches.
WITH detection_run AS (
  INSERT INTO crm.client_identity_resolution_runs (
    run_type_code,
    status_code,
    parameters,
    records_scanned,
    completed_at
  )
  VALUES (
    'CANDIDATE_DETECTION',
    'SUCCEEDED',
    '{"algorithm":"shared_match_keys","version":1}'::jsonb,
    (SELECT count(*) FROM core.party_match_keys WHERE is_active),
    clock_timestamp()
  )
  RETURNING client_identity_resolution_run_id
),
shared_keys AS (
  SELECT
    least(a.party_id, b.party_id) AS party_a_id,
    greatest(a.party_id, b.party_id) AS party_b_id,
    jsonb_agg(DISTINCT a.key_type_code ORDER BY a.key_type_code) AS key_types,
    bool_or(a.strength_code = 'DETERMINISTIC') AS has_deterministic,
    bool_or(a.strength_code = 'STRONG') AS has_strong
  FROM core.party_match_keys a
  JOIN core.party_match_keys b
    ON b.key_type_code = a.key_type_code
   AND b.key_hash_sha256 = a.key_hash_sha256
   AND b.party_id > a.party_id
   AND b.is_active
  WHERE a.is_active
  GROUP BY least(a.party_id, b.party_id), greatest(a.party_id, b.party_id)
)
INSERT INTO core.party_duplicate_candidates (
  party_a_id,
  party_b_id,
  candidate_type_code,
  match_score,
  matched_key_types,
  explanation_ar,
  detection_run_id
)
SELECT
  party_a_id,
  party_b_id,
  CASE WHEN has_deterministic OR has_strong THEN 'EXACT_KEY' ELSE 'FUZZY_REVIEW' END,
  CASE WHEN has_deterministic THEN 1.0000 WHEN has_strong THEN 0.9500 ELSE 0.7500 END,
  key_types,
  CASE
    WHEN has_deterministic THEN 'تطابق معرف قانوني؛ يتطلب مراجعة بشرية قبل الدمج.'
    WHEN has_strong THEN 'تطابق وسيلة اتصال موثقة؛ يتطلب مراجعة بشرية قبل الدمج.'
    ELSE 'تشابه الاسم والدولة؛ لا يسمح بالدمج الآلي.'
  END,
  detection_run.client_identity_resolution_run_id
FROM shared_keys
CROSS JOIN detection_run
ON CONFLICT (party_a_id, party_b_id) DO NOTHING;

CREATE VIEW core.v_party_duplicate_review_queue AS
SELECT
  c.party_duplicate_candidate_id,
  c.party_a_id,
  pa.display_name_ar AS party_a_name_ar,
  c.party_b_id,
  pb.display_name_ar AS party_b_name_ar,
  c.match_score,
  c.matched_key_types,
  c.explanation_ar,
  c.status_code,
  c.detected_at
FROM core.party_duplicate_candidates c
JOIN core.parties pa ON pa.party_id = c.party_a_id
JOIN core.parties pb ON pb.party_id = c.party_b_id
WHERE c.status_code IN ('PENDING_REVIEW', 'UNDER_REVIEW');

CREATE VIEW crm.v_client_canonical_identity AS
SELECT
  ca.client_account_id,
  ca.account_number,
  ca.client_type_code,
  ca.status_code AS client_status_code,
  cil.source_party_id,
  cil.canonical_party_id,
  cp.party_type_code,
  cp.display_name_ar,
  cp.display_name_en,
  cil.resolution_status_code
FROM crm.client_accounts ca
JOIN crm.client_identity_links cil
  ON cil.client_account_id = ca.client_account_id
JOIN core.parties cp
  ON cp.party_id = cil.canonical_party_id;

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0210_v73_client_identity_resolution')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
