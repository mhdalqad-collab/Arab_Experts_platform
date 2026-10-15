BEGIN;
DROP FUNCTION IF EXISTS evidence.create_from_safe_file(uuid,uuid,uuid,varchar,varchar,varchar,text,varchar);
DROP FUNCTION IF EXISTS core.record_file_scan_result(uuid,varchar,varchar,varchar);
DROP FUNCTION IF EXISTS core.confirm_file_upload(uuid,char,char,bigint,varchar,varchar);
DELETE FROM integration.schema_migrations WHERE migration_name='0610_v113_backend_file_scan_evidence';
COMMIT;
