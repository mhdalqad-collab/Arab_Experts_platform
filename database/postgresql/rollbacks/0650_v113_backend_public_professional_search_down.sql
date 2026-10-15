BEGIN;
DROP FUNCTION IF EXISTS professional.search_public_directory(text,varchar,varchar,varchar,varchar,integer,integer);
DROP INDEX IF EXISTS professional.idx_fingerprints_public_directory;
DROP INDEX IF EXISTS membership.idx_memberships_public_directory;
DELETE FROM integration.schema_migrations WHERE migration_name='0650_v113_backend_public_professional_search';
COMMIT;
