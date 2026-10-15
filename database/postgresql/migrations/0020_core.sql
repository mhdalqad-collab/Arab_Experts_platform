BEGIN;

CREATE TABLE core.parties (
  party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type_code varchar(20) NOT NULL
    CHECK (party_type_code IN ('PERSON', 'ORGANIZATION')),
  display_name_ar varchar(240) NOT NULL,
  display_name_en varchar(240),
  preferred_language_code varchar(12)
    REFERENCES reference.languages(language_code),
  status_code varchar(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('PENDING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'ARCHIVED', 'MERGED')),
  merged_into_party_id uuid REFERENCES core.parties(party_id),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by_party_id uuid REFERENCES core.parties(party_id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by_party_id uuid REFERENCES core.parties(party_id),
  archived_at timestamptz,
  CONSTRAINT ck_party_merge
    CHECK (
      (status_code = 'MERGED' AND merged_into_party_id IS NOT NULL AND merged_into_party_id <> party_id)
      OR
      (status_code <> 'MERGED' AND merged_into_party_id IS NULL)
    )
);

CREATE TABLE core.persons (
  party_id uuid PRIMARY KEY
    REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  first_name_ar varchar(100) NOT NULL,
  middle_name_ar varchar(160),
  last_name_ar varchar(100) NOT NULL,
  first_name_en varchar(100),
  middle_name_en varchar(160),
  last_name_en varchar(100),
  date_of_birth date,
  nationality_country_code char(2)
    REFERENCES reference.countries(country_code),
  residence_country_code char(2)
    REFERENCES reference.countries(country_code),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_person_birth_date
    CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE)
);

CREATE TABLE core.organizations (
  party_id uuid PRIMARY KEY
    REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  legal_name_ar varchar(260) NOT NULL,
  legal_name_en varchar(260),
  trading_name_ar varchar(260),
  trading_name_en varchar(260),
  legal_entity_type_code varchar(60)
    REFERENCES reference.legal_entity_types(legal_entity_type_code),
  registration_number varchar(100),
  registration_country_code char(2)
    REFERENCES reference.countries(country_code),
  establishment_date date,
  website_url text,
  is_training_center boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_organization_establishment_date
    CHECK (establishment_date IS NULL OR establishment_date <= CURRENT_DATE),
  UNIQUE NULLS NOT DISTINCT (registration_country_code, registration_number)
);

CREATE TABLE core.organization_units (
  organization_unit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_party_id uuid NOT NULL
    REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  parent_unit_id uuid REFERENCES core.organization_units(organization_unit_id),
  unit_code varchar(60) NOT NULL,
  name_ar varchar(200) NOT NULL,
  name_en varchar(200),
  unit_type_code varchar(40) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_party_id, unit_code)
);

CREATE TABLE core.organization_relationships (
  organization_relationship_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_organization_party_id uuid NOT NULL
    REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  target_organization_party_id uuid NOT NULL
    REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  relationship_type_code varchar(40) NOT NULL,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_organization_relationship_self
    CHECK (source_organization_party_id <> target_organization_party_id),
  CONSTRAINT ck_organization_relationship_period
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE core.party_names (
  party_name_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE CASCADE,
  name_type_code varchar(30) NOT NULL,
  language_code varchar(12) NOT NULL
    REFERENCES reference.languages(language_code),
  name_value varchar(260) NOT NULL,
  valid_from date,
  valid_to date,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_party_name_period
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX uq_party_primary_name_per_language
  ON core.party_names(party_id, language_code)
  WHERE is_primary;

CREATE TABLE core.party_identifiers (
  party_identifier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  identifier_type_code varchar(50) NOT NULL,
  identifier_value varchar(180) NOT NULL,
  issuing_country_code char(2)
    REFERENCES reference.countries(country_code),
  issued_at date,
  expires_at date,
  verification_status_code varchar(30) NOT NULL DEFAULT 'UNVERIFIED',
  is_sensitive boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_party_identifier_dates
    CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at),
  UNIQUE NULLS NOT DISTINCT
    (identifier_type_code, issuing_country_code, identifier_value)
);

CREATE TABLE core.addresses (
  address_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code char(2) NOT NULL
    REFERENCES reference.countries(country_code),
  subdivision_id uuid
    REFERENCES reference.country_subdivisions(subdivision_id),
  city_name varchar(160),
  district_name varchar(160),
  address_line_1 varchar(240),
  address_line_2 varchar(240),
  postal_code varchar(40),
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_address_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT ck_address_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE core.party_addresses (
  party_address_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE CASCADE,
  address_id uuid NOT NULL REFERENCES core.addresses(address_id) ON DELETE RESTRICT,
  address_type_code varchar(30) NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_party_address_period CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX uq_party_primary_address
  ON core.party_addresses(party_id, address_type_code)
  WHERE is_primary AND valid_to IS NULL;

CREATE TABLE core.party_contacts (
  party_contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE CASCADE,
  contact_method_type_code varchar(40) NOT NULL
    REFERENCES reference.contact_method_types(contact_method_type_code),
  contact_value text NOT NULL,
  normalized_value text NOT NULL,
  label_ar varchar(100),
  label_en varchar(100),
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_party_contact_verification
    CHECK ((is_verified AND verified_at IS NOT NULL) OR (NOT is_verified)),
  CONSTRAINT ck_party_contact_period
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX uq_party_active_contact
  ON core.party_contacts(party_id, contact_method_type_code, normalized_value)
  WHERE valid_to IS NULL;

CREATE UNIQUE INDEX uq_party_primary_contact
  ON core.party_contacts(party_id, contact_method_type_code)
  WHERE is_primary AND valid_to IS NULL;

CREATE TABLE core.party_languages (
  party_language_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE CASCADE,
  language_code varchar(12) NOT NULL
    REFERENCES reference.languages(language_code),
  proficiency_code varchar(20) NOT NULL
    CHECK (proficiency_code IN ('BASIC', 'INTERMEDIATE', 'ADVANCED', 'FLUENT', 'NATIVE')),
  can_deliver_training boolean NOT NULL DEFAULT false,
  can_provide_consulting boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (party_id, language_code)
);

CREATE TABLE core.files (
  file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_provider_code varchar(40) NOT NULL,
  storage_object_key text NOT NULL UNIQUE,
  original_file_name varchar(500) NOT NULL,
  media_type varchar(160) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256_hash char(64) NOT NULL,
  scan_status_code varchar(30) NOT NULL DEFAULT 'PENDING'
    CHECK (scan_status_code IN ('PENDING', 'SCANNING', 'SAFE', 'QUARANTINED', 'REJECTED')),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  uploaded_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);

CREATE INDEX idx_parties_status ON core.parties(status_code) WHERE archived_at IS NULL;
CREATE INDEX idx_parties_display_name_ar ON core.parties(display_name_ar);
CREATE INDEX idx_parties_display_name_en ON core.parties(display_name_en);
CREATE INDEX idx_organizations_training_centers
  ON core.organizations(party_id) WHERE is_training_center;
CREATE INDEX idx_party_contacts_normalized
  ON core.party_contacts(contact_method_type_code, normalized_value);
CREATE INDEX idx_files_sha256 ON core.files(sha256_hash);

CREATE TRIGGER trg_parties_updated_at
BEFORE UPDATE ON core.parties
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_persons_updated_at
BEFORE UPDATE ON core.persons
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_persons_enforce_party_type
BEFORE INSERT OR UPDATE OF party_id ON core.persons
FOR EACH ROW EXECUTE FUNCTION core.enforce_party_subtype();
CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON core.organizations
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_organizations_enforce_party_type
BEFORE INSERT OR UPDATE OF party_id ON core.organizations
FOR EACH ROW EXECUTE FUNCTION core.enforce_party_subtype();
CREATE TRIGGER trg_organization_units_updated_at
BEFORE UPDATE ON core.organization_units
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_addresses_updated_at
BEFORE UPDATE ON core.addresses
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_party_languages_updated_at
BEFORE UPDATE ON core.party_languages
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0020_core')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
