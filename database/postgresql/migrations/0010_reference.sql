BEGIN;

CREATE TABLE reference.countries (
  country_code char(2) PRIMARY KEY,
  iso3_code char(3) UNIQUE,
  numeric_code char(3) UNIQUE,
  name_ar varchar(160) NOT NULL,
  name_en varchar(160) NOT NULL,
  calling_code varchar(16),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE reference.country_subdivisions (
  subdivision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code char(2) NOT NULL
    REFERENCES reference.countries(country_code),
  subdivision_code varchar(16) NOT NULL,
  subdivision_type_code varchar(40),
  name_ar varchar(180) NOT NULL,
  name_en varchar(180),
  parent_subdivision_id uuid
    REFERENCES reference.country_subdivisions(subdivision_id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (country_code, subdivision_code)
);

CREATE TABLE reference.languages (
  language_code varchar(12) PRIMARY KEY,
  name_ar varchar(100) NOT NULL,
  name_en varchar(100) NOT NULL,
  native_name varchar(100),
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE reference.currencies (
  currency_code char(3) PRIMARY KEY,
  name_ar varchar(100) NOT NULL,
  name_en varchar(100) NOT NULL,
  symbol varchar(12),
  decimal_places smallint NOT NULL DEFAULT 2
    CHECK (decimal_places BETWEEN 0 AND 4),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE reference.contact_method_types (
  contact_method_type_code varchar(40) PRIMARY KEY,
  name_ar varchar(100) NOT NULL,
  name_en varchar(100) NOT NULL,
  value_pattern text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0)
);

CREATE TABLE reference.legal_entity_types (
  legal_entity_type_code varchar(60) PRIMARY KEY,
  name_ar varchar(220) NOT NULL,
  name_en varchar(220) NOT NULL,
  applies_to_country_code char(2)
    REFERENCES reference.countries(country_code),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0)
);

CREATE TABLE reference.document_types (
  document_type_code varchar(60) PRIMARY KEY,
  name_ar varchar(160) NOT NULL,
  name_en varchar(160) NOT NULL,
  default_confidentiality_code varchar(40),
  requires_expiry_date boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE reference.delivery_modes (
  delivery_mode_code varchar(20) PRIMARY KEY,
  name_ar varchar(60) NOT NULL,
  name_en varchar(60) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0)
);

CREATE TABLE reference.confidentiality_levels (
  confidentiality_level_code varchar(50) PRIMARY KEY,
  name_ar varchar(220) NOT NULL,
  name_en varchar(220) NOT NULL,
  sensitivity_rank smallint NOT NULL UNIQUE
    CHECK (sensitivity_rank BETWEEN 1 AND 10),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_country_subdivisions_parent
  ON reference.country_subdivisions(parent_subdivision_id);
CREATE INDEX idx_country_subdivisions_name_ar
  ON reference.country_subdivisions(name_ar);
CREATE INDEX idx_languages_featured
  ON reference.languages(display_order)
  WHERE is_featured AND is_active;

CREATE TRIGGER trg_countries_updated_at
BEFORE UPDATE ON reference.countries
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_country_subdivisions_updated_at
BEFORE UPDATE ON reference.country_subdivisions
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_languages_updated_at
BEFORE UPDATE ON reference.languages
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER trg_currencies_updated_at
BEFORE UPDATE ON reference.currencies
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0010_reference')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
