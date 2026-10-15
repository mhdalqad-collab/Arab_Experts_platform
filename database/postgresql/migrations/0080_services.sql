BEGIN;

CREATE TABLE services.service_catalog_items (
  service_catalog_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code varchar(70) NOT NULL UNIQUE,
  service_type_code varchar(60) NOT NULL
    REFERENCES reference.service_types(service_type_code),
  name_ar varchar(260) NOT NULL,
  name_en varchar(260) NOT NULL,
  description_ar text,
  description_en text,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE services.provider_capabilities (
  provider_capability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL
    REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  service_catalog_item_id uuid NOT NULL
    REFERENCES services.service_catalog_items(service_catalog_item_id),
  taxonomy_node_id uuid NOT NULL REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  experience_level_code varchar(40) NOT NULL
    REFERENCES reference.experience_levels(experience_level_code),
  years_of_experience integer CHECK (years_of_experience IS NULL OR years_of_experience BETWEEN 0 AND 80),
  capacity_description_ar text,
  verification_status_code varchar(30) NOT NULL DEFAULT 'UNVERIFIED',
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (membership_id, service_catalog_item_id, taxonomy_node_id)
);

CREATE TABLE services.service_offers (
  service_offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_capability_id uuid NOT NULL
    REFERENCES services.provider_capabilities(provider_capability_id) ON DELETE RESTRICT,
  offer_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(300) NOT NULL,
  title_en varchar(300),
  summary_ar text NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'REVIEW_PENDING', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED')),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE services.service_offer_versions (
  service_offer_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_offer_id uuid NOT NULL
    REFERENCES services.service_offers(service_offer_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  scope_ar text NOT NULL,
  deliverables_ar text,
  assumptions_ar text,
  exclusions_ar text,
  estimated_duration_days integer CHECK (estimated_duration_days IS NULL OR estimated_duration_days > 0),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'APPROVED', 'CURRENT', 'SUPERSEDED', 'WITHDRAWN')),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  UNIQUE (service_offer_id, version_no)
);

CREATE UNIQUE INDEX uq_current_service_offer_version
  ON services.service_offer_versions(service_offer_id)
  WHERE status_code = 'CURRENT';

CREATE TABLE services.service_pricing_options (
  service_pricing_option_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_offer_version_id uuid NOT NULL
    REFERENCES services.service_offer_versions(service_offer_version_id) ON DELETE CASCADE,
  pricing_model_code varchar(30) NOT NULL
    CHECK (pricing_model_code IN ('HOURLY', 'DAILY', 'FIXED', 'MILESTONE', 'CUSTOM_QUOTE')),
  amount numeric(18,3) CHECK (amount IS NULL OR amount >= 0),
  currency_code char(3) REFERENCES reference.currencies(currency_code),
  minimum_quantity numeric(12,2) CHECK (minimum_quantity IS NULL OR minimum_quantity > 0),
  notes_ar text,
  is_public boolean NOT NULL DEFAULT false,
  CONSTRAINT ck_service_price_value
    CHECK (
      pricing_model_code = 'CUSTOM_QUOTE'
      OR (amount IS NOT NULL AND currency_code IS NOT NULL)
    )
);

CREATE TABLE services.service_delivery_options (
  service_delivery_option_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_offer_version_id uuid NOT NULL
    REFERENCES services.service_offer_versions(service_offer_version_id) ON DELETE CASCADE,
  delivery_mode_code varchar(20) NOT NULL
    REFERENCES reference.delivery_modes(delivery_mode_code),
  notes_ar text,
  UNIQUE (service_offer_version_id, delivery_mode_code)
);

CREATE TABLE services.service_geographies (
  service_geography_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_offer_version_id uuid NOT NULL
    REFERENCES services.service_offer_versions(service_offer_version_id) ON DELETE CASCADE,
  country_code char(2) NOT NULL REFERENCES reference.countries(country_code),
  subdivision_id uuid REFERENCES reference.country_subdivisions(subdivision_id),
  UNIQUE NULLS NOT DISTINCT (service_offer_version_id, country_code, subdivision_id)
);

CREATE TABLE services.service_offer_taxonomy (
  service_offer_taxonomy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_offer_id uuid NOT NULL
    REFERENCES services.service_offers(service_offer_id) ON DELETE CASCADE,
  taxonomy_node_id uuid NOT NULL REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  assignment_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY',
  UNIQUE (service_offer_id, taxonomy_node_id, assignment_role_code)
);

CREATE TABLE services.service_packages (
  service_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  package_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(260) NOT NULL,
  name_en varchar(260),
  description_ar text,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE services.service_package_items (
  service_package_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_package_id uuid NOT NULL
    REFERENCES services.service_packages(service_package_id) ON DELETE CASCADE,
  service_offer_id uuid NOT NULL
    REFERENCES services.service_offers(service_offer_id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (service_package_id, service_offer_id)
);

CREATE INDEX idx_provider_capabilities_provider
  ON services.provider_capabilities(provider_party_id, status_code);
CREATE INDEX idx_provider_capabilities_taxonomy
  ON services.provider_capabilities(taxonomy_node_id, experience_level_code);
CREATE INDEX idx_service_offers_published
  ON services.service_offers(provider_capability_id)
  WHERE status_code = 'PUBLISHED';
CREATE INDEX idx_service_offer_taxonomy_node
  ON services.service_offer_taxonomy(taxonomy_node_id);

CREATE TRIGGER trg_service_catalog_updated_at
BEFORE UPDATE ON services.service_catalog_items
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_provider_capability_membership
BEFORE INSERT OR UPDATE OF membership_id, provider_party_id
ON services.provider_capabilities
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'membership_id',
  'provider_party_id',
  'EXPERT,TRAINER,CONSULTANT,RESEARCHER_ACADEMIC,TRAINING_CENTER'
);
CREATE TRIGGER trg_provider_capabilities_updated_at
BEFORE UPDATE ON services.provider_capabilities
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_service_offers_updated_at
BEFORE UPDATE ON services.service_offers
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_service_offers_controlled_status
BEFORE UPDATE OF status_code ON services.service_offers
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_service_packages_updated_at
BEFORE UPDATE ON services.service_packages
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0080_services')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
