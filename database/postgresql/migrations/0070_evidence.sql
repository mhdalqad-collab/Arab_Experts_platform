BEGIN;

CREATE TABLE evidence.evidence_items (
  evidence_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  evidence_type_code varchar(60) NOT NULL,
  title_ar varchar(300) NOT NULL,
  title_en varchar(300),
  description_ar text,
  issued_by_party_id uuid REFERENCES core.parties(party_id),
  issuer_name varchar(260),
  issued_at date,
  expires_at date,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'SCREENING', 'VERIFICATION_PENDING',
      'VERIFIED', 'PARTIALLY_VERIFIED', 'REJECTED', 'EXPIRED',
      'REVOKED', 'SUPERSEDED'
    )),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  superseded_by_evidence_item_id uuid
    REFERENCES evidence.evidence_items(evidence_item_id),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_evidence_period CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at),
  CONSTRAINT ck_evidence_superseded
    CHECK (
      (status_code = 'SUPERSEDED' AND superseded_by_evidence_item_id IS NOT NULL
        AND superseded_by_evidence_item_id <> evidence_item_id)
      OR
      (status_code <> 'SUPERSEDED' AND superseded_by_evidence_item_id IS NULL)
    )
);

CREATE TABLE evidence.evidence_files (
  evidence_file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL
    REFERENCES evidence.evidence_items(evidence_item_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  file_role_code varchar(40) NOT NULL DEFAULT 'PRIMARY_EVIDENCE',
  display_order integer NOT NULL CHECK (display_order > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (evidence_item_id, file_id)
);

CREATE TABLE evidence.evidence_claims (
  evidence_claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL
    REFERENCES evidence.evidence_items(evidence_item_id) ON DELETE CASCADE,
  claim_type_code varchar(50) NOT NULL,
  claim_text_ar text NOT NULL,
  claim_text_en text,
  claimed_value_json jsonb,
  status_code varchar(30) NOT NULL DEFAULT 'UNASSESSED'
    CHECK (status_code IN ('UNASSESSED', 'VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE evidence.evidence_links (
  evidence_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL
    REFERENCES evidence.evidence_items(evidence_item_id) ON DELETE CASCADE,
  target_entity_type varchar(80) NOT NULL,
  target_entity_id uuid NOT NULL,
  relationship_code varchar(40) NOT NULL
    CHECK (relationship_code IN ('SUPPORTS', 'PROVES', 'CONTRADICTS', 'UPDATES', 'REPLACES')),
  relevance_score numeric(6,5) CHECK (relevance_score IS NULL OR relevance_score BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (evidence_item_id, target_entity_type, target_entity_id, relationship_code)
);

CREATE TABLE evidence.verification_sources (
  verification_source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type_code varchar(40) NOT NULL,
  source_party_id uuid REFERENCES core.parties(party_id),
  source_name varchar(260),
  source_url text,
  reliability_score numeric(6,5) CHECK (reliability_score IS NULL OR reliability_score BETWEEN 0 AND 1),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_verification_source_identity
    CHECK (source_party_id IS NOT NULL OR source_name IS NOT NULL)
);

CREATE TABLE evidence.verification_requests (
  verification_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL
    REFERENCES evidence.evidence_items(evidence_item_id) ON DELETE RESTRICT,
  request_type_code varchar(40) NOT NULL,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  assigned_to_party_id uuid REFERENCES core.parties(party_id),
  status_code varchar(30) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status_code IN (
      'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'SOURCE_RESPONSE_PENDING',
      'DECIDED', 'CANCELLED', 'EXPIRED'
    )),
  priority_code varchar(20) NOT NULL DEFAULT 'NORMAL',
  due_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_open_verification_request
  ON evidence.verification_requests(evidence_item_id, request_type_code)
  WHERE status_code NOT IN ('DECIDED', 'CANCELLED', 'EXPIRED');

CREATE TABLE evidence.verification_checks (
  verification_check_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id uuid NOT NULL
    REFERENCES evidence.verification_requests(verification_request_id) ON DELETE CASCADE,
  verification_source_id uuid
    REFERENCES evidence.verification_sources(verification_source_id),
  check_type_code varchar(50) NOT NULL,
  check_result_code varchar(30) NOT NULL
    CHECK (check_result_code IN ('PASS', 'PARTIAL', 'FAIL', 'INCONCLUSIVE')),
  checked_claim_ids uuid[] NOT NULL DEFAULT '{}',
  response_reference text,
  notes text,
  checked_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  checked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE evidence.verification_decisions (
  verification_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id uuid NOT NULL UNIQUE
    REFERENCES evidence.verification_requests(verification_request_id) ON DELETE RESTRICT,
  decision_code varchar(30) NOT NULL
    CHECK (decision_code IN ('VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED', 'REJECTED')),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  rationale text NOT NULL,
  decided_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_verification_decision_period CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT ck_verifier_not_requester
    CHECK (decided_by_party_id IS NOT NULL)
);

CREATE TABLE evidence.certainty_models (
  certainty_model_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_code varchar(60) NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  name_ar varchar(200) NOT NULL,
  name_en varchar(200) NOT NULL,
  configuration_json jsonb NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'RETIRED')),
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (model_code, version_no),
  CONSTRAINT ck_certainty_model_period
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX uq_active_certainty_model
  ON evidence.certainty_models(model_code)
  WHERE status_code = 'ACTIVE';

CREATE TABLE evidence.certainty_assessments (
  certainty_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certainty_model_id uuid NOT NULL
    REFERENCES evidence.certainty_models(certainty_model_id),
  target_entity_type varchar(80) NOT NULL,
  target_entity_id uuid NOT NULL,
  score numeric(6,5) NOT NULL CHECK (score BETWEEN 0 AND 1),
  confidence_band_code varchar(30) NOT NULL,
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  calculation_snapshot jsonb NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  triggered_by_event_code varchar(60),
  created_by_party_id uuid REFERENCES core.parties(party_id)
);

CREATE UNIQUE INDEX uq_current_certainty_assessment
  ON evidence.certainty_assessments(target_entity_type, target_entity_id)
  WHERE is_current;

CREATE TABLE evidence.certainty_factors (
  certainty_factor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certainty_assessment_id uuid NOT NULL
    REFERENCES evidence.certainty_assessments(certainty_assessment_id) ON DELETE CASCADE,
  factor_code varchar(50) NOT NULL,
  raw_score numeric(6,5) NOT NULL CHECK (raw_score BETWEEN 0 AND 1),
  weight numeric(6,5) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  weighted_score numeric(6,5) NOT NULL CHECK (weighted_score BETWEEN 0 AND 1),
  explanation_ar text,
  UNIQUE (certainty_assessment_id, factor_code)
);

CREATE TABLE evidence.rating_dimensions (
  rating_dimension_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_code varchar(50) NOT NULL UNIQUE,
  name_ar varchar(140) NOT NULL,
  name_en varchar(140) NOT NULL,
  applies_to_entity_type varchar(80) NOT NULL,
  default_weight numeric(6,5) NOT NULL CHECK (default_weight BETWEEN 0 AND 1),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE evidence.ratings (
  rating_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rated_entity_type varchar(80) NOT NULL,
  rated_entity_id uuid NOT NULL,
  rater_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  source_transaction_type varchar(80) NOT NULL,
  source_transaction_id uuid NOT NULL,
  overall_rating numeric(3,2) NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  review_text text,
  status_code varchar(30) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status_code IN (
      'ELIGIBLE', 'INVITED', 'DRAFT', 'SUBMITTED', 'SCREENED',
      'PUBLISHED', 'REJECTED', 'HIDDEN_UNDER_REVIEW', 'REMOVED'
    )),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  UNIQUE (rater_party_id, source_transaction_type, source_transaction_id, rated_entity_type, rated_entity_id)
);

CREATE TABLE evidence.rating_responses (
  rating_response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id uuid NOT NULL REFERENCES evidence.ratings(rating_id) ON DELETE CASCADE,
  rating_dimension_id uuid NOT NULL
    REFERENCES evidence.rating_dimensions(rating_dimension_id),
  rating_value numeric(3,2) NOT NULL CHECK (rating_value BETWEEN 1 AND 5),
  comment text,
  UNIQUE (rating_id, rating_dimension_id)
);

CREATE TABLE evidence.reputation_profiles (
  reputation_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_entity_type varchar(80) NOT NULL,
  target_entity_id uuid NOT NULL,
  average_rating numeric(3,2) CHECK (average_rating IS NULL OR average_rating BETWEEN 1 AND 5),
  rating_count integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  quality_score numeric(6,5) CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 1),
  complaint_adjustment numeric(6,5) NOT NULL DEFAULT 0
    CHECK (complaint_adjustment BETWEEN 0 AND 1),
  calculated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (target_entity_type, target_entity_id)
);

CREATE TABLE evidence.complaints (
  complaint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number varchar(40) NOT NULL UNIQUE,
  complainant_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  respondent_party_id uuid REFERENCES core.parties(party_id),
  target_entity_type varchar(80),
  target_entity_id uuid,
  complaint_type_code varchar(50) NOT NULL,
  subject_ar varchar(260) NOT NULL,
  description_ar text NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'TRIAGED', 'INVESTIGATION', 'RESPONSE_REQUIRED',
      'DECIDED', 'REMEDY_IN_PROGRESS', 'RESOLVED', 'APPEALED',
      'APPEAL_DECIDED', 'CLOSED'
    )),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  submitted_at timestamptz,
  resolved_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE evidence.complaint_evidence (
  complaint_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES evidence.complaints(complaint_id) ON DELETE CASCADE,
  evidence_item_id uuid REFERENCES evidence.evidence_items(evidence_item_id),
  file_id uuid REFERENCES core.files(file_id),
  description text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_complaint_evidence_source
    CHECK (evidence_item_id IS NOT NULL OR file_id IS NOT NULL)
);

CREATE TABLE evidence.complaint_decisions (
  complaint_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES evidence.complaints(complaint_id) ON DELETE RESTRICT,
  decision_code varchar(40) NOT NULL,
  rationale text NOT NULL,
  remedy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  affects_reputation boolean NOT NULL DEFAULT false,
  decided_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE evidence.appeals (
  appeal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES evidence.complaints(complaint_id) ON DELETE RESTRICT,
  appellant_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  grounds text NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status_code IN ('SUBMITTED', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED', 'DISMISSED')),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  decided_at timestamptz,
  decided_by_party_id uuid REFERENCES core.parties(party_id)
);

CREATE INDEX idx_evidence_owner_status
  ON evidence.evidence_items(owner_party_id, status_code);
CREATE INDEX idx_evidence_links_target
  ON evidence.evidence_links(target_entity_type, target_entity_id);
CREATE INDEX idx_verification_queue
  ON evidence.verification_requests(status_code, priority_code, due_at);
CREATE INDEX idx_certainty_target_history
  ON evidence.certainty_assessments(target_entity_type, target_entity_id, assessed_at DESC);
CREATE INDEX idx_ratings_target_published
  ON evidence.ratings(rated_entity_type, rated_entity_id, submitted_at DESC)
  WHERE status_code = 'PUBLISHED';
CREATE INDEX idx_complaints_status
  ON evidence.complaints(status_code, submitted_at);

CREATE TRIGGER trg_evidence_items_updated_at
BEFORE UPDATE ON evidence.evidence_items
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_evidence_items_controlled_status
BEFORE UPDATE OF status_code ON evidence.evidence_items
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_verification_requests_updated_at
BEFORE UPDATE ON evidence.verification_requests
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_verification_requests_controlled_status
BEFORE UPDATE OF status_code ON evidence.verification_requests
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_complaints_updated_at
BEFORE UPDATE ON evidence.complaints
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_complaints_controlled_status
BEFORE UPDATE OF status_code ON evidence.complaints
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0070_evidence')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
