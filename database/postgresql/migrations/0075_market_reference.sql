BEGIN;

CREATE TABLE reference.service_types (
  service_type_code varchar(60) PRIMARY KEY,
  name_ar varchar(200) NOT NULL,
  name_en varchar(200) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.client_types (
  client_type_code varchar(60) PRIMARY KEY,
  name_ar varchar(220) NOT NULL,
  name_en varchar(220) NOT NULL,
  is_organization boolean NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.client_registration_purposes (
  registration_purpose_code varchar(70) PRIMARY KEY,
  name_ar varchar(260) NOT NULL,
  name_en varchar(260) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0075_market_reference')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
