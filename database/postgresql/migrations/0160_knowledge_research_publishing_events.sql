BEGIN;

-- EIM 6.4 / Version 22: research, publishing, events and knowledge management.

CREATE TABLE knowledge.research_projects (
  research_project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(500) NOT NULL,
  title_en varchar(500),
  abstract_ar text NOT NULL,
  abstract_en text,
  lead_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  sponsor_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  project_id uuid REFERENCES delivery.projects(project_id) ON DELETE RESTRICT,
  research_type_code varchar(40) NOT NULL
    CHECK (research_type_code IN (
      'BASIC', 'APPLIED', 'ACTION_RESEARCH', 'CASE_STUDY',
      'DEVELOPMENT', 'EVALUATION', 'POLICY', 'MARKET'
    )),
  methodology_summary text,
  ethics_approval_reference varchar(160),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  visibility_code varchar(20) NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility_code IN ('PUBLIC', 'MEMBERS', 'RESTRICTED', 'PRIVATE')),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE',
      'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'
    )),
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz,
  CONSTRAINT ck_research_planned_period
    CHECK (planned_end_date IS NULL OR planned_start_date IS NULL OR planned_end_date >= planned_start_date),
  CONSTRAINT ck_research_actual_period
    CHECK (actual_end_date IS NULL OR actual_start_date IS NULL OR actual_end_date >= actual_start_date)
);

CREATE TABLE knowledge.research_project_parties (
  research_project_party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_project_id uuid NOT NULL
    REFERENCES knowledge.research_projects(research_project_id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  participation_role_code varchar(40) NOT NULL
    CHECK (participation_role_code IN (
      'LEAD_RESEARCHER', 'CO_RESEARCHER', 'SUPERVISOR', 'ADVISOR',
      'DATA_ANALYST', 'FIELD_RESEARCHER', 'SPONSOR', 'PARTNER', 'REVIEWER'
    )),
  contribution_statement text,
  contribution_percentage numeric(5,2)
    CHECK (contribution_percentage IS NULL OR contribution_percentage BETWEEN 0 AND 100),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_research_party_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (research_project_id, party_id, participation_role_code, valid_from)
);

CREATE TABLE knowledge.research_taxonomy_assignments (
  research_taxonomy_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_project_id uuid NOT NULL
    REFERENCES knowledge.research_projects(research_project_id) ON DELETE CASCADE,
  taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE RESTRICT,
  assignment_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY'
    CHECK (assignment_role_code IN ('PRIMARY', 'SECONDARY', 'METHOD', 'SECTOR', 'PRACTICE')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (research_project_id, taxonomy_node_id, assignment_role_code)
);

CREATE TABLE knowledge.publications (
  publication_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_code varchar(60) NOT NULL UNIQUE,
  canonical_title_ar varchar(500) NOT NULL,
  canonical_title_en varchar(500),
  publication_type_code varchar(50) NOT NULL
    CHECK (publication_type_code IN (
      'ORIGINAL_ARTICLE', 'REVIEW_ARTICLE', 'CASE_REPORT', 'SHORT_COMMUNICATION',
      'METHODOLOGY_PAPER', 'PERSPECTIVE_COMMENTARY', 'CONFERENCE_PAPER',
      'THESIS_DISSERTATION', 'BOOK_CHAPTER', 'EDITED_BOOK', 'OTHER_SPECIALIZED'
    )),
  primary_language_code varchar(12) NOT NULL
    REFERENCES reference.languages(language_code),
  research_project_id uuid
    REFERENCES knowledge.research_projects(research_project_id) ON DELETE SET NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  publisher_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  doi citext,
  isbn varchar(40),
  external_url text,
  peer_review_status_code varchar(30) NOT NULL DEFAULT 'NOT_REVIEWED'
    CHECK (peer_review_status_code IN (
      'NOT_REVIEWED', 'INTERNAL_REVIEW', 'UNDER_PEER_REVIEW', 'PEER_REVIEWED', 'REJECTED'
    )),
  license_code varchar(50),
  visibility_code varchar(20) NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility_code IN ('PUBLIC', 'MEMBERS', 'RESTRICTED', 'PRIVATE')),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
      'PUBLISHED', 'WITHDRAWN', 'RETRACTED', 'SUPERSEDED', 'ARCHIVED'
    )),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  published_at date,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz,
  UNIQUE NULLS NOT DISTINCT (doi),
  CONSTRAINT ck_publication_publish_date
    CHECK (status_code <> 'PUBLISHED' OR published_at IS NOT NULL)
);

CREATE TABLE knowledge.publication_versions (
  publication_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL
    REFERENCES knowledge.publications(publication_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  title_ar varchar(500) NOT NULL,
  title_en varchar(500),
  abstract_ar text,
  abstract_en text,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  citation_text text,
  change_summary text,
  content_hash char(64),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
      'PUBLISHED', 'REJECTED', 'SUPERSEDED', 'RETRACTED'
    )),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  UNIQUE (publication_id, version_no)
);

CREATE TABLE knowledge.publication_authors (
  publication_author_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL
    REFERENCES knowledge.publications(publication_id) ON DELETE CASCADE,
  author_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  external_author_name varchar(300),
  external_author_affiliation varchar(300),
  author_order integer NOT NULL CHECK (author_order > 0),
  is_corresponding_author boolean NOT NULL DEFAULT false,
  contribution_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  contribution_statement text,
  rights_confirmed_at timestamptz,
  CONSTRAINT ck_publication_author_identity
    CHECK (author_party_id IS NOT NULL OR external_author_name IS NOT NULL),
  UNIQUE (publication_id, author_order),
  UNIQUE NULLS NOT DISTINCT (publication_id, author_party_id)
);

CREATE TABLE knowledge.publication_files (
  publication_file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_version_id uuid NOT NULL
    REFERENCES knowledge.publication_versions(publication_version_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  file_role_code varchar(30) NOT NULL
    CHECK (file_role_code IN ('MANUSCRIPT', 'PUBLISHED_COPY', 'SUPPLEMENT', 'DATASET', 'REVIEW', 'LICENSE')),
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order > 0),
  UNIQUE (publication_version_id, file_id, file_role_code)
);

CREATE TABLE knowledge.publication_taxonomy_assignments (
  publication_taxonomy_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL
    REFERENCES knowledge.publications(publication_id) ON DELETE CASCADE,
  taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE RESTRICT,
  assignment_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY'
    CHECK (assignment_role_code IN ('PRIMARY', 'SECONDARY', 'METHOD', 'SECTOR', 'PRACTICE')),
  UNIQUE (publication_id, taxonomy_node_id, assignment_role_code)
);

CREATE TABLE knowledge.peer_reviews (
  peer_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_version_id uuid NOT NULL
    REFERENCES knowledge.publication_versions(publication_version_id) ON DELETE CASCADE,
  reviewer_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  review_round smallint NOT NULL DEFAULT 1 CHECK (review_round > 0),
  recommendation_code varchar(30) NOT NULL
    CHECK (recommendation_code IN ('ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT')),
  comments_to_author text,
  confidential_comments text,
  conflict_declared boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (publication_version_id, reviewer_party_id, review_round)
);

CREATE TABLE knowledge.events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(400) NOT NULL,
  title_en varchar(400),
  description_ar text,
  description_en text,
  event_type_code varchar(40) NOT NULL
    CHECK (event_type_code IN (
      'CONFERENCE', 'SEMINAR', 'PANEL', 'KNOWLEDGE_WORKSHOP',
      'EXPERT_FORUM', 'RESEARCH_PRESENTATION', 'COMMUNITY_OF_PRACTICE'
    )),
  organizer_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  research_project_id uuid
    REFERENCES knowledge.research_projects(research_project_id) ON DELETE SET NULL,
  delivery_mode_code varchar(30) NOT NULL
    REFERENCES reference.delivery_modes(delivery_mode_code),
  country_code char(2) REFERENCES reference.countries(country_code),
  venue_name varchar(300),
  virtual_join_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  waitlist_capacity integer CHECK (waitlist_capacity IS NULL OR waitlist_capacity >= 0),
  visibility_code varchar(20) NOT NULL DEFAULT 'PUBLIC'
    CHECK (visibility_code IN ('PUBLIC', 'MEMBERS', 'INVITED', 'PRIVATE')),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'APPROVED', 'OPEN_REGISTRATION',
      'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'
    )),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_event_period CHECK (ends_at > starts_at),
  CONSTRAINT ck_event_registration_period CHECK (
    registration_closes_at IS NULL OR registration_opens_at IS NULL
    OR registration_closes_at >= registration_opens_at
  ),
  CONSTRAINT ck_event_place CHECK (
    delivery_mode_code NOT IN ('IN_PERSON', 'HYBRID') OR venue_name IS NOT NULL
  )
);

CREATE TABLE knowledge.event_sessions (
  event_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES knowledge.events(event_id) ON DELETE CASCADE,
  session_code varchar(50) NOT NULL,
  title_ar varchar(400) NOT NULL,
  title_en varchar(400),
  description_ar text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  room_or_channel varchar(200),
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  status_code varchar(20) NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status_code IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT ck_event_session_period CHECK (ends_at > starts_at),
  UNIQUE (event_id, session_code)
);

CREATE TABLE knowledge.event_participants (
  event_participant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES knowledge.events(event_id) ON DELETE CASCADE,
  event_session_id uuid REFERENCES knowledge.event_sessions(event_session_id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  participant_role_code varchar(30) NOT NULL
    CHECK (participant_role_code IN (
      'CHAIR', 'SPEAKER', 'PANELIST', 'FACILITATOR', 'ORGANIZER', 'REVIEWER', 'VOLUNTEER'
    )),
  biography_snapshot text,
  display_order integer CHECK (display_order IS NULL OR display_order > 0),
  confirmed_at timestamptz,
  UNIQUE NULLS NOT DISTINCT (event_id, event_session_id, party_id, participant_role_code)
);

CREATE TABLE knowledge.event_registrations (
  event_registration_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES knowledge.events(event_id) ON DELETE RESTRICT,
  attendee_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  registration_status_code varchar(30) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (registration_status_code IN (
      'PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'REJECTED', 'ATTENDED', 'NO_SHOW'
    )),
  registration_channel_code varchar(30) NOT NULL DEFAULT 'PLATFORM',
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cancelled_at timestamptz,
  cancellation_reason text,
  certificate_file_id uuid REFERENCES core.files(file_id) ON DELETE RESTRICT,
  UNIQUE (event_id, attendee_party_id)
);

CREATE TABLE knowledge.event_attendance (
  event_attendance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id uuid NOT NULL
    REFERENCES knowledge.event_registrations(event_registration_id) ON DELETE CASCADE,
  event_session_id uuid REFERENCES knowledge.event_sessions(event_session_id) ON DELETE CASCADE,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  attendance_minutes integer CHECK (attendance_minutes IS NULL OR attendance_minutes >= 0),
  verification_method_code varchar(30),
  CONSTRAINT ck_attendance_period
    CHECK (checked_out_at IS NULL OR checked_in_at IS NULL OR checked_out_at >= checked_in_at),
  UNIQUE NULLS NOT DISTINCT (event_registration_id, event_session_id)
);

CREATE TABLE knowledge.event_taxonomy_assignments (
  event_taxonomy_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES knowledge.events(event_id) ON DELETE CASCADE,
  taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE RESTRICT,
  assignment_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY',
  UNIQUE (event_id, taxonomy_node_id, assignment_role_code)
);

CREATE TABLE knowledge.knowledge_assets (
  knowledge_asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_asset_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(500) NOT NULL,
  title_en varchar(500),
  asset_type_code varchar(40) NOT NULL
    CHECK (asset_type_code IN (
      'PROCEDURE_GUIDE', 'CASE_STUDY', 'LESSON_LEARNED', 'TEMPLATE_TOOL',
      'TECHNICAL_REPORT', 'DATASET', 'RECORDING', 'EXPERT_QA'
    )),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  steward_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  source_research_project_id uuid
    REFERENCES knowledge.research_projects(research_project_id) ON DELETE SET NULL,
  source_event_id uuid REFERENCES knowledge.events(event_id) ON DELETE SET NULL,
  source_delivery_lesson_id uuid
    REFERENCES delivery.lessons_learned(lesson_learned_id) ON DELETE SET NULL,
  primary_language_code varchar(12) NOT NULL
    REFERENCES reference.languages(language_code),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  visibility_code varchar(20) NOT NULL DEFAULT 'MEMBERS'
    CHECK (visibility_code IN ('PUBLIC', 'MEMBERS', 'RESTRICTED', 'PRIVATE')),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED',
      'SUPERSEDED', 'RETIRED', 'ARCHIVED'
    )),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  review_due_date date,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);

CREATE TABLE knowledge.knowledge_asset_versions (
  knowledge_asset_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_asset_id uuid NOT NULL
    REFERENCES knowledge.knowledge_assets(knowledge_asset_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_label varchar(40),
  summary_ar text,
  summary_en text,
  content_text text,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  license_code varchar(50),
  content_hash char(64),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'RETIRED')),
  change_summary text,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_by_party_id uuid REFERENCES core.parties(party_id),
  approved_at timestamptz,
  UNIQUE (knowledge_asset_id, version_no)
);

CREATE TABLE knowledge.knowledge_asset_files (
  knowledge_asset_file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_asset_version_id uuid NOT NULL
    REFERENCES knowledge.knowledge_asset_versions(knowledge_asset_version_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  file_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY',
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order > 0),
  UNIQUE (knowledge_asset_version_id, file_id, file_role_code)
);

CREATE TABLE knowledge.knowledge_asset_relations (
  knowledge_asset_relation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_asset_id uuid NOT NULL
    REFERENCES knowledge.knowledge_assets(knowledge_asset_id) ON DELETE CASCADE,
  target_asset_id uuid NOT NULL
    REFERENCES knowledge.knowledge_assets(knowledge_asset_id) ON DELETE RESTRICT,
  relation_type_code varchar(30) NOT NULL
    CHECK (relation_type_code IN (
      'DERIVED_FROM', 'SUPERSEDES', 'RELATED_TO', 'DEPENDS_ON', 'TRANSLATES', 'SUMMARIZES'
    )),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_asset_relation_self CHECK (source_asset_id <> target_asset_id),
  UNIQUE (source_asset_id, target_asset_id, relation_type_code)
);

CREATE TABLE knowledge.knowledge_asset_taxonomy (
  knowledge_asset_taxonomy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_asset_id uuid NOT NULL
    REFERENCES knowledge.knowledge_assets(knowledge_asset_id) ON DELETE CASCADE,
  taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE RESTRICT,
  assignment_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY',
  UNIQUE (knowledge_asset_id, taxonomy_node_id, assignment_role_code)
);

CREATE TABLE knowledge.knowledge_usage_events (
  knowledge_usage_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_asset_id uuid REFERENCES knowledge.knowledge_assets(knowledge_asset_id) ON DELETE SET NULL,
  publication_id uuid REFERENCES knowledge.publications(publication_id) ON DELETE SET NULL,
  actor_party_id uuid REFERENCES core.parties(party_id) ON DELETE SET NULL,
  usage_type_code varchar(30) NOT NULL
    CHECK (usage_type_code IN ('VIEW', 'DOWNLOAD', 'CITE', 'SHARE', 'REUSE', 'RATE')),
  context_type varchar(60),
  context_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_knowledge_usage_target
    CHECK (num_nonnulls(knowledge_asset_id, publication_id) = 1)
);

CREATE INDEX idx_research_status ON knowledge.research_projects(status_code, planned_end_date);
CREATE INDEX idx_research_owner ON knowledge.research_projects(owner_party_id, status_code);
CREATE INDEX idx_publication_status_date ON knowledge.publications(status_code, published_at DESC);
CREATE INDEX idx_publication_research ON knowledge.publications(research_project_id);
CREATE INDEX idx_publication_author_party ON knowledge.publication_authors(author_party_id);
CREATE INDEX idx_event_start_status ON knowledge.events(starts_at, status_code);
CREATE INDEX idx_event_registration_status ON knowledge.event_registrations(event_id, registration_status_code);
CREATE INDEX idx_asset_owner_status ON knowledge.knowledge_assets(owner_party_id, status_code);
CREATE INDEX idx_asset_review_due ON knowledge.knowledge_assets(review_due_date)
  WHERE status_code IN ('APPROVED', 'PUBLISHED');
CREATE INDEX idx_knowledge_usage_asset_time
  ON knowledge.knowledge_usage_events(knowledge_asset_id, occurred_at DESC);

CREATE TRIGGER trg_research_updated_at
BEFORE UPDATE ON knowledge.research_projects
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_publications_updated_at
BEFORE UPDATE ON knowledge.publications
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON knowledge.events
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_knowledge_assets_updated_at
BEFORE UPDATE ON knowledge.knowledge_assets
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TRIGGER trg_research_controlled_status
BEFORE UPDATE OF status_code ON knowledge.research_projects
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_publication_controlled_status
BEFORE UPDATE OF status_code ON knowledge.publications
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_event_controlled_status
BEFORE UPDATE OF status_code ON knowledge.events
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_asset_controlled_status
BEFORE UPDATE OF status_code ON knowledge.knowledge_assets
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0160_knowledge_research_publishing_events')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
