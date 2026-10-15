BEGIN;
DROP FUNCTION IF EXISTS core.consume_file_download_session(uuid,char);
DROP FUNCTION IF EXISTS core.issue_file_download_session(uuid,uuid,uuid,uuid,char,boolean,boolean,timestamptz,varchar);
DROP FUNCTION IF EXISTS core.grant_file_access(uuid,uuid,uuid,uuid,varchar,timestamptz,uuid,varchar);
DROP TABLE IF EXISTS core.file_download_sessions;
DROP TABLE IF EXISTS core.file_access_grants;
DELETE FROM integration.schema_migrations WHERE migration_name='0630_v113_backend_private_downloads';
COMMIT;
