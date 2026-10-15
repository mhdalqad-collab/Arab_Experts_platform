BEGIN;

CREATE TABLE reference.need_types (
  need_type_code varchar(70) PRIMARY KEY,
  name_ar varchar(240) NOT NULL,
  name_en varchar(240) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.matching_criteria (
  matching_criterion_code varchar(70) PRIMARY KEY,
  name_ar varchar(200) NOT NULL,
  name_en varchar(200) NOT NULL,
  data_type_code varchar(30) NOT NULL
    CHECK (data_type_code IN ('SCORE', 'BOOLEAN', 'NUMBER', 'CATEGORY', 'RANGE')),
  default_weight numeric(6,3) NOT NULL CHECK (default_weight BETWEEN 0 AND 100),
  supports_hard_constraint boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0105_needs_matching_reference')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
