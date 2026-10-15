BEGIN;
DROP FUNCTION IF EXISTS core.register_file_upload_intent(uuid,uuid,uuid,char,text,varchar,varchar,bigint,char,varchar,timestamptz,uuid,varchar);
DROP TABLE IF EXISTS core.file_upload_sessions;
DELETE FROM integration.schema_migrations WHERE migration_name='0600_v113_backend_secure_files';
COMMIT;
