BEGIN;

CREATE TABLE reference.academic_qualification_types (
  qualification_type_code varchar(40) PRIMARY KEY,
  name_ar varchar(120) NOT NULL,
  name_en varchar(120) NOT NULL,
  qualification_rank smallint NOT NULL UNIQUE CHECK (qualification_rank > 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.job_levels (
  job_level_code varchar(50) PRIMARY KEY,
  name_ar varchar(160) NOT NULL,
  name_en varchar(160) NOT NULL,
  level_rank smallint NOT NULL UNIQUE CHECK (level_rank > 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.experience_levels (
  experience_level_code varchar(40) PRIMARY KEY,
  name_ar varchar(120) NOT NULL,
  name_en varchar(120) NOT NULL,
  level_rank smallint NOT NULL UNIQUE CHECK (level_rank > 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.expert_roles (
  expert_role_code varchar(50) PRIMARY KEY,
  name_ar varchar(140) NOT NULL,
  name_en varchar(140) NOT NULL,
  responsibility_weight numeric(5,2) NOT NULL
    CHECK (responsibility_weight BETWEEN 0 AND 100),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.experience_types (
  experience_type_code varchar(50) PRIMARY KEY,
  name_ar varchar(140) NOT NULL,
  name_en varchar(140) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.work_natures (
  work_nature_code varchar(40) PRIMARY KEY,
  name_ar varchar(100) NOT NULL,
  name_en varchar(100) NOT NULL,
  lifecycle_order smallint NOT NULL UNIQUE CHECK (lifecycle_order > 0),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE reference.course_levels (
  course_level_code varchar(50) PRIMARY KEY,
  name_ar varchar(160) NOT NULL,
  name_en varchar(160) NOT NULL,
  level_rank smallint NOT NULL UNIQUE CHECK (level_rank > 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

CREATE TABLE reference.industry_sectors (
  industry_sector_code varchar(60) PRIMARY KEY,
  name_ar varchar(260) NOT NULL,
  name_en varchar(260) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0)
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0045_professional_reference')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
