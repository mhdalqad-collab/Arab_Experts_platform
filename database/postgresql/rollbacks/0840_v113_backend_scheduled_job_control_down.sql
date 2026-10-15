BEGIN;
DROP FUNCTION IF EXISTS integration.run_publication_reverification_job(uuid,uuid,date,varchar);
DROP TABLE IF EXISTS integration.scheduled_job_runs;
DROP TABLE IF EXISTS integration.scheduled_job_definitions;
DELETE FROM integration.schema_migrations WHERE migration_name='0840_v113_backend_scheduled_job_control';
COMMIT;
