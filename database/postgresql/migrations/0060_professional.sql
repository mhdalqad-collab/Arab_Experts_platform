BEGIN;

CREATE TABLE professional.professional_profiles (
  professional_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL UNIQUE REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  current_job_title_ar varchar(220),
  current_job_title_en varchar(220),
  job_level_code varchar(50) REFERENCES reference.job_levels(job_level_code),
  total_professional_experience_years integer
    CHECK (total_professional_experience_years IS NULL
      OR total_professional_experience_years BETWEEN 0 AND 80),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'PRIVATE', 'PENDING_REVIEW', 'PUBLISHED',
      'PARTIALLY_VERIFIED', 'VERIFIED', 'UPDATE_REQUIRED', 'HIDDEN', 'ARCHIVED'
    )),
  completeness_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (completeness_percentage BETWEEN 0 AND 100),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE professional.professional_summaries (
  professional_summary_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  summary_ar text NOT NULL,
  summary_en text,
  is_current boolean NOT NULL DEFAULT false,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (professional_profile_id, version_no)
);

CREATE UNIQUE INDEX uq_professional_current_summary
  ON professional.professional_summaries(professional_profile_id)
  WHERE is_current;

CREATE TABLE professional.profile_work_natures (
  profile_work_nature_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  work_nature_code varchar(40) NOT NULL REFERENCES reference.work_natures(work_nature_code),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (professional_profile_id, work_nature_code)
);

CREATE TABLE professional.academic_qualifications (
  academic_qualification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  qualification_type_code varchar(40) NOT NULL
    REFERENCES reference.academic_qualification_types(qualification_type_code),
  field_of_study_ar varchar(220) NOT NULL,
  field_of_study_en varchar(220),
  awarding_institution_party_id uuid REFERENCES core.organizations(party_id),
  awarding_institution_name_ar varchar(260),
  awarding_institution_name_en varchar(260),
  country_code char(2) REFERENCES reference.countries(country_code),
  graduation_year integer NOT NULL
    CHECK (graduation_year BETWEEN 1900 AND 2200),
  verification_status_code varchar(30) NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status_code IN (
      'UNVERIFIED', 'PENDING', 'PARTIALLY_VERIFIED', 'VERIFIED', 'REJECTED', 'EXPIRED'
    )),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_qualification_institution
    CHECK (
      awarding_institution_party_id IS NOT NULL
      OR awarding_institution_name_ar IS NOT NULL
    )
);

CREATE TABLE professional.professional_certifications (
  professional_certification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  certification_name_ar varchar(260) NOT NULL,
  certification_name_en varchar(260),
  issuing_organization_party_id uuid REFERENCES core.organizations(party_id),
  issuing_organization_name varchar(260),
  credential_number varchar(140),
  obtained_at date NOT NULL,
  expires_at date,
  credential_url text,
  verification_status_code varchar(30) NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status_code IN (
      'UNVERIFIED', 'PENDING', 'PARTIALLY_VERIFIED', 'VERIFIED', 'REJECTED', 'EXPIRED'
    )),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_certification_period CHECK (expires_at IS NULL OR expires_at >= obtained_at),
  CONSTRAINT ck_certification_issuer
    CHECK (
      issuing_organization_party_id IS NOT NULL
      OR issuing_organization_name IS NOT NULL
    )
);

CREATE TABLE professional.employment_experiences (
  employment_experience_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  employer_organization_party_id uuid REFERENCES core.organizations(party_id),
  employer_name_ar varchar(260),
  employer_name_en varchar(260),
  job_title_ar varchar(220) NOT NULL,
  job_title_en varchar(220),
  job_level_code varchar(50) REFERENCES reference.job_levels(job_level_code),
  experience_type_code varchar(50) REFERENCES reference.experience_types(experience_type_code),
  country_code char(2) REFERENCES reference.countries(country_code),
  started_at date NOT NULL,
  ended_at date,
  responsibilities_ar text,
  outcomes_ar text,
  is_current boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_employment_period CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT ck_employment_employer
    CHECK (employer_organization_party_id IS NOT NULL OR employer_name_ar IS NOT NULL)
);

CREATE TABLE professional.project_experiences (
  project_experience_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  project_name_ar varchar(300) NOT NULL,
  project_name_en varchar(300),
  client_party_id uuid REFERENCES core.parties(party_id),
  client_name_ar varchar(260),
  country_code char(2) REFERENCES reference.countries(country_code),
  execution_year integer NOT NULL CHECK (execution_year BETWEEN 1900 AND 2200),
  duration_days integer CHECK (duration_days IS NULL OR duration_days > 0),
  expert_role_code varchar(50) REFERENCES reference.expert_roles(expert_role_code),
  role_description_ar text,
  verified_outcome_ar text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE professional.training_experiences (
  training_experience_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  course_name_ar varchar(300) NOT NULL,
  course_name_en varchar(300),
  training_center_party_id uuid REFERENCES core.organizations(party_id),
  delivery_mode_code varchar(20) REFERENCES reference.delivery_modes(delivery_mode_code),
  course_level_code varchar(50) NOT NULL
    REFERENCES reference.course_levels(course_level_code),
  delivery_date date,
  duration_hours numeric(8,2) CHECK (duration_hours IS NULL OR duration_hours > 0),
  participant_count integer CHECK (participant_count IS NULL OR participant_count >= 0),
  rating_value numeric(3,2) CHECK (rating_value IS NULL OR rating_value BETWEEN 1 AND 5),
  country_code char(2) REFERENCES reference.countries(country_code),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE professional.consulting_experiences (
  consulting_experience_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  engagement_title_ar varchar(300) NOT NULL,
  engagement_title_en varchar(300),
  client_party_id uuid REFERENCES core.parties(party_id),
  client_type_code varchar(60),
  country_code char(2) REFERENCES reference.countries(country_code),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  started_at date,
  ended_at date,
  delivery_mode_code varchar(20) REFERENCES reference.delivery_modes(delivery_mode_code),
  outcome_summary_ar text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_consulting_period CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE professional.research_experiences (
  research_experience_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  research_title_ar varchar(320) NOT NULL,
  research_title_en varchar(320),
  host_organization_party_id uuid REFERENCES core.organizations(party_id),
  research_role_code varchar(50) NOT NULL,
  started_at date,
  ended_at date,
  outcome_summary_ar text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_research_experience_period
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE professional.professional_sectors (
  professional_sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  industry_sector_code varchar(60) NOT NULL
    REFERENCES reference.industry_sectors(industry_sector_code),
  is_current boolean NOT NULL DEFAULT false,
  years_of_experience integer CHECK (years_of_experience IS NULL OR years_of_experience BETWEEN 0 AND 80),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (professional_profile_id, industry_sector_code)
);

CREATE TABLE professional.availability_periods (
  availability_period_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  available_from date NOT NULL,
  available_to date,
  delivery_mode_code varchar(20) REFERENCES reference.delivery_modes(delivery_mode_code),
  available_hours_per_week numeric(5,2)
    CHECK (available_hours_per_week IS NULL OR available_hours_per_week BETWEEN 0 AND 168),
  notes_ar text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_availability_period CHECK (available_to IS NULL OR available_to >= available_from)
);

CREATE TABLE professional.pricing_profiles (
  pricing_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  hourly_rate_usd numeric(18,3) CHECK (hourly_rate_usd IS NULL OR hourly_rate_usd >= 0),
  daily_rate_usd numeric(18,3) CHECK (daily_rate_usd IS NULL OR daily_rate_usd >= 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_pricing_period CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT ck_pricing_has_rate CHECK (hourly_rate_usd IS NOT NULL OR daily_rate_usd IS NOT NULL)
);

CREATE UNIQUE INDEX uq_active_pricing_profile
  ON professional.pricing_profiles(professional_profile_id)
  WHERE effective_to IS NULL;

CREATE TABLE professional.professional_fingerprints (
  professional_fingerprint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  fingerprint_code varchar(60) NOT NULL,
  title_ar varchar(300) NOT NULL,
  title_en varchar(300),
  primary_taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  experience_level_code varchar(40) NOT NULL
    REFERENCES reference.experience_levels(experience_level_code),
  expert_role_code varchar(50) NOT NULL REFERENCES reference.expert_roles(expert_role_code),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'UPDATE_REQUIRED', 'SUPERSEDED', 'ARCHIVED')),
  current_certainty_score numeric(6,5)
    CHECK (current_certainty_score IS NULL OR current_certainty_score BETWEEN 0 AND 1),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (professional_profile_id, fingerprint_code)
);

CREATE TABLE professional.fingerprint_versions (
  fingerprint_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_fingerprint_id uuid NOT NULL
    REFERENCES professional.professional_fingerprints(professional_fingerprint_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  snapshot_json jsonb NOT NULL,
  change_summary text,
  effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by_party_id uuid REFERENCES core.parties(party_id),
  UNIQUE (professional_fingerprint_id, version_no)
);

CREATE TABLE professional.fingerprint_components (
  fingerprint_component_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_fingerprint_id uuid NOT NULL
    REFERENCES professional.professional_fingerprints(professional_fingerprint_id) ON DELETE CASCADE,
  component_type_code varchar(40) NOT NULL
    CHECK (component_type_code IN (
      'KNOWLEDGE', 'SKILL', 'APPLIED_EXPERIENCE', 'COMPOUND_ABILITY',
      'PROFESSIONAL_BEHAVIOR', 'VALUE_MOTIVE', 'MENTAL_MODEL',
      'REASONING_PATTERN'
    )),
  taxonomy_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  description_ar text NOT NULL,
  strength_score numeric(6,5) CHECK (strength_score IS NULL OR strength_score BETWEEN 0 AND 1),
  display_order integer NOT NULL CHECK (display_order > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE professional.fingerprint_contexts (
  fingerprint_context_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_fingerprint_id uuid NOT NULL
    REFERENCES professional.professional_fingerprints(professional_fingerprint_id) ON DELETE CASCADE,
  context_type_code varchar(50) NOT NULL,
  context_description_ar text NOT NULL,
  complexity_level smallint CHECK (complexity_level IS NULL OR complexity_level BETWEEN 1 AND 5),
  frequency_count integer CHECK (frequency_count IS NULL OR frequency_count >= 0),
  first_observed_at date,
  last_observed_at date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_fingerprint_context_period
    CHECK (last_observed_at IS NULL OR first_observed_at IS NULL OR last_observed_at >= first_observed_at)
);

CREATE TABLE professional.fingerprint_outcomes (
  fingerprint_outcome_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_fingerprint_id uuid NOT NULL
    REFERENCES professional.professional_fingerprints(professional_fingerprint_id) ON DELETE CASCADE,
  outcome_title_ar varchar(260) NOT NULL,
  outcome_description_ar text NOT NULL,
  result_type_code varchar(50) NOT NULL,
  measured_value numeric(20,5),
  measurement_unit varchar(40),
  achieved_at date,
  verification_status_code varchar(30) NOT NULL DEFAULT 'UNVERIFIED',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_professional_profiles_status
  ON professional.professional_profiles(status_code);
CREATE INDEX idx_academic_qualifications_profile
  ON professional.academic_qualifications(professional_profile_id, graduation_year DESC);
CREATE INDEX idx_employment_profile_dates
  ON professional.employment_experiences(professional_profile_id, started_at DESC);
CREATE INDEX idx_fingerprints_taxonomy
  ON professional.professional_fingerprints(primary_taxonomy_node_id, status_code);
CREATE INDEX idx_fingerprint_components_type
  ON professional.fingerprint_components(professional_fingerprint_id, component_type_code);

CREATE TRIGGER trg_professional_profiles_updated_at
BEFORE UPDATE ON professional.professional_profiles
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_professional_profiles_controlled_status
BEFORE UPDATE OF status_code ON professional.professional_profiles
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_qualifications_updated_at
BEFORE UPDATE ON professional.academic_qualifications
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_certifications_updated_at
BEFORE UPDATE ON professional.professional_certifications
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_employment_updated_at
BEFORE UPDATE ON professional.employment_experiences
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_project_experiences_updated_at
BEFORE UPDATE ON professional.project_experiences
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_training_experiences_updated_at
BEFORE UPDATE ON professional.training_experiences
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_consulting_experiences_updated_at
BEFORE UPDATE ON professional.consulting_experiences
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_research_experiences_updated_at
BEFORE UPDATE ON professional.research_experiences
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_fingerprints_updated_at
BEFORE UPDATE ON professional.professional_fingerprints
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0060_professional')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
