BEGIN;

CREATE TABLE training.training_centers (
  training_center_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_party_id uuid NOT NULL UNIQUE
    REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL UNIQUE
    REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  profile_summary_ar text,
  verification_status_code varchar(30) NOT NULL DEFAULT 'UNVERIFIED',
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'ARCHIVED')),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE training.training_facilities (
  training_facility_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_center_id uuid NOT NULL
    REFERENCES training.training_centers(training_center_id) ON DELETE CASCADE,
  facility_name_ar varchar(220) NOT NULL,
  address_id uuid REFERENCES core.addresses(address_id),
  delivery_mode_code varchar(20) NOT NULL
    REFERENCES reference.delivery_modes(delivery_mode_code),
  capacity integer NOT NULL CHECK (capacity > 0),
  description_ar text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE training.courses (
  course_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code varchar(60) NOT NULL UNIQUE,
  canonical_title_ar varchar(320) NOT NULL,
  canonical_title_en varchar(320),
  normalized_title_ar varchar(320) NOT NULL,
  normalized_title_en varchar(320),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'DUPLICATE_CHECK', 'CLASSIFICATION_PENDING',
      'REVIEW_PENDING', 'APPROVED', 'PUBLISHED', 'SUSPENDED', 'MERGED', 'ARCHIVED'
    )),
  merged_into_course_id uuid REFERENCES training.courses(course_id),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_course_merge CHECK (
    (status_code = 'MERGED' AND merged_into_course_id IS NOT NULL AND merged_into_course_id <> course_id)
    OR (status_code <> 'MERGED' AND merged_into_course_id IS NULL)
  )
);

CREATE TABLE training.course_names (
  course_name_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training.courses(course_id) ON DELETE CASCADE,
  language_code varchar(12) NOT NULL REFERENCES reference.languages(language_code),
  name_type_code varchar(30) NOT NULL
    CHECK (name_type_code IN ('PRIMARY', 'ALTERNATIVE', 'LEGACY', 'MARKETING')),
  name_value varchar(320) NOT NULL,
  normalized_value varchar(320) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (course_id, language_code, name_type_code, normalized_value)
);

CREATE TABLE training.course_versions (
  course_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training.courses(course_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_label varchar(60),
  description_ar text NOT NULL,
  description_en text,
  duration_hours numeric(8,2) NOT NULL CHECK (duration_hours > 0),
  course_level_code varchar(50) NOT NULL
    REFERENCES reference.course_levels(course_level_code),
  language_code varchar(12) NOT NULL REFERENCES reference.languages(language_code),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'REVIEW_PENDING', 'APPROVED', 'CURRENT', 'SUPERSEDED', 'WITHDRAWN')),
  content_hash char(64),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  UNIQUE (course_id, version_no)
);

CREATE UNIQUE INDEX uq_current_course_version
  ON training.course_versions(course_id) WHERE status_code = 'CURRENT';

CREATE TABLE training.course_taxonomy_assignments (
  course_taxonomy_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training.courses(course_id) ON DELETE CASCADE,
  taxonomy_node_id uuid NOT NULL REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  assignment_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY',
  UNIQUE (course_id, taxonomy_node_id, assignment_role_code)
);

CREATE TABLE training.course_target_audiences (
  course_target_audience_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL
    REFERENCES training.course_versions(course_version_id) ON DELETE CASCADE,
  taxonomy_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  audience_name_ar varchar(240),
  minimum_experience_level_code varchar(40)
    REFERENCES reference.experience_levels(experience_level_code),
  notes_ar text,
  CONSTRAINT ck_course_audience_definition
    CHECK (taxonomy_node_id IS NOT NULL OR audience_name_ar IS NOT NULL)
);

CREATE TABLE training.course_learning_outcomes (
  course_learning_outcome_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL
    REFERENCES training.course_versions(course_version_id) ON DELETE CASCADE,
  outcome_ar text NOT NULL,
  outcome_en text,
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (course_version_id, display_order)
);

CREATE TABLE training.course_modules (
  course_module_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL
    REFERENCES training.course_versions(course_version_id) ON DELETE CASCADE,
  module_title_ar varchar(260) NOT NULL,
  module_title_en varchar(260),
  description_ar text,
  duration_hours numeric(8,2) CHECK (duration_hours IS NULL OR duration_hours > 0),
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (course_version_id, display_order)
);

CREATE TABLE training.course_owners (
  course_owner_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training.courses(course_id) ON DELETE RESTRICT,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  ownership_type_code varchar(30) NOT NULL,
  ownership_percentage numeric(5,2) NOT NULL CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_course_owner_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (course_id, owner_party_id, valid_from)
);

CREATE TABLE training.course_authors (
  course_author_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL
    REFERENCES training.course_versions(course_version_id) ON DELETE CASCADE,
  author_party_id uuid REFERENCES core.parties(party_id),
  external_author_name varchar(260),
  contribution_role_code varchar(40) NOT NULL,
  author_order integer NOT NULL CHECK (author_order > 0),
  CONSTRAINT ck_course_author_identity
    CHECK (author_party_id IS NOT NULL OR external_author_name IS NOT NULL),
  UNIQUE (course_version_id, author_order)
);

CREATE TABLE training.course_delivery_rights (
  course_delivery_right_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training.courses(course_id) ON DELETE RESTRICT,
  grantee_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  right_type_code varchar(40) NOT NULL
    CHECK (right_type_code IN ('OWNER', 'EXCLUSIVE', 'NON_EXCLUSIVE', 'SINGLE_OFFERING')),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  territory_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  may_delegate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_course_delivery_right_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (course_id, grantee_party_id, right_type_code, valid_from)
);

CREATE TABLE training.course_duplicate_candidates (
  course_duplicate_candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_course_id uuid NOT NULL REFERENCES training.courses(course_id) ON DELETE CASCADE,
  existing_course_id uuid NOT NULL REFERENCES training.courses(course_id) ON DELETE RESTRICT,
  title_similarity numeric(6,5) NOT NULL CHECK (title_similarity BETWEEN 0 AND 1),
  taxonomy_similarity numeric(6,5) NOT NULL CHECK (taxonomy_similarity BETWEEN 0 AND 1),
  content_similarity numeric(6,5) CHECK (content_similarity IS NULL OR content_similarity BETWEEN 0 AND 1),
  overall_similarity numeric(6,5) NOT NULL CHECK (overall_similarity BETWEEN 0 AND 1),
  recommendation_code varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_duplicate_courses_different CHECK (proposed_course_id <> existing_course_id),
  UNIQUE (proposed_course_id, existing_course_id)
);

CREATE TABLE training.course_merge_decisions (
  course_merge_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_course_id uuid NOT NULL REFERENCES training.courses(course_id),
  retained_course_id uuid NOT NULL REFERENCES training.courses(course_id),
  decision_code varchar(40) NOT NULL
    CHECK (decision_code IN ('USE_EXISTING', 'CREATE_NEW_VERSION', 'KEEP_SEPARATE', 'MERGE')),
  rationale text NOT NULL,
  decided_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_course_merge_decision_different CHECK (proposed_course_id <> retained_course_id)
);

CREATE TABLE training.course_offerings (
  course_offering_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL
    REFERENCES training.course_versions(course_version_id) ON DELETE RESTRICT,
  offering_code varchar(60) NOT NULL UNIQUE,
  delivery_mode_code varchar(20) NOT NULL REFERENCES reference.delivery_modes(delivery_mode_code),
  language_code varchar(12) NOT NULL REFERENCES reference.languages(language_code),
  country_code char(2) REFERENCES reference.countries(country_code),
  address_id uuid REFERENCES core.addresses(address_id),
  timezone_name varchar(80) NOT NULL,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SCHEDULED', 'REGISTRATION_OPEN', 'FULL',
      'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED'
    )),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_offering_period CHECK (ends_at > starts_at),
  CONSTRAINT ck_offering_registration_period CHECK (
    registration_closes_at IS NULL OR registration_opens_at IS NULL
    OR registration_closes_at >= registration_opens_at
  ),
  CONSTRAINT ck_offering_location CHECK (
    delivery_mode_code = 'REMOTE' OR country_code IS NOT NULL
  )
);

CREATE TABLE training.offering_trainers (
  offering_trainer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL
    REFERENCES training.course_offerings(course_offering_id) ON DELETE CASCADE,
  trainer_membership_id uuid NOT NULL
    REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  trainer_role_code varchar(30) NOT NULL DEFAULT 'LEAD',
  is_confirmed boolean NOT NULL DEFAULT false,
  UNIQUE (course_offering_id, trainer_membership_id)
);

CREATE TABLE training.offering_training_centers (
  offering_training_center_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL
    REFERENCES training.course_offerings(course_offering_id) ON DELETE CASCADE,
  training_center_id uuid NOT NULL
    REFERENCES training.training_centers(training_center_id) ON DELETE RESTRICT,
  center_role_code varchar(30) NOT NULL DEFAULT 'DELIVERY_CENTER',
  is_confirmed boolean NOT NULL DEFAULT false,
  UNIQUE (course_offering_id, training_center_id)
);

CREATE TABLE training.offering_schedules (
  offering_schedule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL
    REFERENCES training.course_offerings(course_offering_id) ON DELETE CASCADE,
  session_no integer NOT NULL CHECK (session_no > 0),
  session_title_ar varchar(260),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  meeting_url text,
  facility_id uuid REFERENCES training.training_facilities(training_facility_id),
  CONSTRAINT ck_offering_session_period CHECK (ends_at > starts_at),
  UNIQUE (course_offering_id, session_no)
);

CREATE TABLE training.offering_prices (
  offering_price_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL
    REFERENCES training.course_offerings(course_offering_id) ON DELETE CASCADE,
  price_type_code varchar(30) NOT NULL DEFAULT 'STANDARD',
  amount numeric(18,3) NOT NULL CHECK (amount >= 0),
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  valid_from timestamptz,
  valid_to timestamptz,
  CONSTRAINT ck_offering_price_period CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  UNIQUE (course_offering_id, price_type_code)
);

CREATE TABLE training.course_registrations (
  course_registration_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL
    REFERENCES training.course_offerings(course_offering_id) ON DELETE RESTRICT,
  participant_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  payer_party_id uuid REFERENCES core.parties(party_id),
  status_code varchar(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status_code IN (
      'PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'WAITLISTED',
      'CANCELLED', 'COMPLETED', 'NO_SHOW'
    )),
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cancelled_at timestamptz,
  UNIQUE (course_offering_id, participant_party_id)
);

CREATE TABLE training.attendance_records (
  attendance_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_registration_id uuid NOT NULL
    REFERENCES training.course_registrations(course_registration_id) ON DELETE CASCADE,
  offering_schedule_id uuid NOT NULL
    REFERENCES training.offering_schedules(offering_schedule_id) ON DELETE CASCADE,
  attendance_status_code varchar(20) NOT NULL
    CHECK (attendance_status_code IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  attended_minutes integer CHECK (attended_minutes IS NULL OR attended_minutes >= 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (course_registration_id, offering_schedule_id)
);

CREATE TABLE training.course_reviews (
  course_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_registration_id uuid NOT NULL UNIQUE
    REFERENCES training.course_registrations(course_registration_id) ON DELETE RESTRICT,
  course_rating numeric(3,2) NOT NULL CHECK (course_rating BETWEEN 1 AND 5),
  trainer_rating numeric(3,2) CHECK (trainer_rating IS NULL OR trainer_rating BETWEEN 1 AND 5),
  center_rating numeric(3,2) CHECK (center_rating IS NULL OR center_rating BETWEEN 1 AND 5),
  review_text text,
  status_code varchar(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status_code IN ('SUBMITTED', 'PUBLISHED', 'HIDDEN', 'REJECTED')),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_course_names_search
  ON training.course_names(language_code, normalized_value);
CREATE INDEX idx_course_taxonomy
  ON training.course_taxonomy_assignments(taxonomy_node_id);
CREATE INDEX idx_course_duplicate_score
  ON training.course_duplicate_candidates(proposed_course_id, overall_similarity DESC);
CREATE INDEX idx_offerings_search
  ON training.course_offerings(status_code, starts_at, country_code, language_code);
CREATE INDEX idx_offering_trainers_membership
  ON training.offering_trainers(trainer_membership_id);
CREATE INDEX idx_course_registrations_participant
  ON training.course_registrations(participant_party_id, registered_at DESC);

CREATE TRIGGER trg_training_centers_updated_at
BEFORE UPDATE ON training.training_centers
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_training_center_membership
BEFORE INSERT OR UPDATE OF membership_id, organization_party_id
ON training.training_centers
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'membership_id',
  'organization_party_id',
  'TRAINING_CENTER'
);
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON training.courses
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_courses_controlled_status
BEFORE UPDATE OF status_code ON training.courses
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_offerings_updated_at
BEFORE UPDATE ON training.course_offerings
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_offerings_controlled_status
BEFORE UPDATE OF status_code ON training.course_offerings
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_offering_trainer_membership
BEFORE INSERT OR UPDATE OF trainer_membership_id
ON training.offering_trainers
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'trainer_membership_id',
  '',
  'TRAINER'
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0090_training')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
