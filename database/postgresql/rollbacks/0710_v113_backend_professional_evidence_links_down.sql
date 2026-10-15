BEGIN;
DROP FUNCTION IF EXISTS evidence.link_owned_professional_evidence(uuid,varchar,uuid,uuid,uuid,varchar,numeric,varchar);
DROP INDEX IF EXISTS evidence.idx_evidence_links_target;
DELETE FROM integration.schema_migrations WHERE migration_name='0710_v113_backend_professional_evidence_links';COMMIT;
