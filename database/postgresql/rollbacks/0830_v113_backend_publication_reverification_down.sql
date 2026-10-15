BEGIN;
DROP FUNCTION IF EXISTS professional.evaluate_publication_reverification(uuid,uuid,date,varchar);
DROP TABLE IF EXISTS professional.publication_reverification_alerts;
DROP TABLE IF EXISTS professional.publication_reverification_assessments;
DROP TABLE IF EXISTS professional.publication_reverification_policies;
DELETE FROM integration.schema_migrations WHERE migration_name='0830_v113_backend_publication_reverification';
COMMIT;
