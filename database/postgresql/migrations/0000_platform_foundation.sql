BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS reference;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS membership;
CREATE SCHEMA IF NOT EXISTS professional;
CREATE SCHEMA IF NOT EXISTS taxonomy;
CREATE SCHEMA IF NOT EXISTS evidence;
CREATE SCHEMA IF NOT EXISTS services;
CREATE SCHEMA IF NOT EXISTS training;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS needs;
CREATE SCHEMA IF NOT EXISTS matching;
CREATE SCHEMA IF NOT EXISTS delivery;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE SCHEMA IF NOT EXISTS governance;
CREATE SCHEMA IF NOT EXISTS integration;

CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION core.set_updated_at_and_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION core.reject_direct_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  status_field text;
BEGIN
  status_field := COALESCE(NULLIF(TG_ARGV[0], ''), 'status_code');
  IF (to_jsonb(NEW) -> status_field) IS DISTINCT FROM (to_jsonb(OLD) -> status_field)
     AND current_setting('eim.transition_context', true) IS DISTINCT FROM 'allowed' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Status changes must use the controlled transition service.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION core.enforce_party_subtype()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_type varchar(20);
  actual_type varchar(20);
BEGIN
  expected_type := CASE TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    WHEN 'core.persons' THEN 'PERSON'
    WHEN 'core.organizations' THEN 'ORGANIZATION'
    ELSE NULL
  END;

  SELECT party_type_code
    INTO actual_type
    FROM core.parties
   WHERE party_id = NEW.party_id;

  IF expected_type IS NULL OR actual_type IS DISTINCT FROM expected_type THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Party %s must have party_type_code %s for table %I.%I.',
        NEW.party_id, expected_type, TG_TABLE_SCHEMA, TG_TABLE_NAME
      );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS integration.schema_migrations (
  migration_name varchar(160) PRIMARY KEY,
  checksum_sha256 char(64),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  applied_by text NOT NULL DEFAULT current_user
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0000_platform_foundation')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
