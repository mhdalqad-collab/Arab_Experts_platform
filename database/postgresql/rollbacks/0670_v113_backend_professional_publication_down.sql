BEGIN;
DROP FUNCTION IF EXISTS professional.decide_profile_publication(uuid,uuid,uuid,varchar,text,varchar);
DROP FUNCTION IF EXISTS professional.recommend_profile_publication(uuid,uuid,uuid,varchar,text,varchar);
DROP FUNCTION IF EXISTS professional.claim_profile_publication_review(uuid,uuid,uuid,varchar);
DROP FUNCTION IF EXISTS professional.submit_profile_publication(uuid,uuid,bigint,varchar);
DROP TABLE IF EXISTS professional.profile_publication_requests;
DELETE FROM integration.schema_migrations WHERE migration_name='0670_v113_backend_professional_publication';
COMMIT;
