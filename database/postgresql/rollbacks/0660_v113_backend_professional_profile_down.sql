BEGIN;
DROP INDEX IF EXISTS professional.idx_fingerprint_versions_history;
DELETE FROM integration.schema_migrations WHERE migration_name='0660_v113_backend_professional_profile';
COMMIT;
