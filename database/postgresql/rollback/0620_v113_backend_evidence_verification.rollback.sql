BEGIN;
DROP FUNCTION IF EXISTS evidence.decide_verification_request(uuid,uuid,uuid,varchar,text,date,varchar);
DROP FUNCTION IF EXISTS evidence.add_verification_check(uuid,uuid,uuid,varchar,varchar,text,text,varchar);
DROP FUNCTION IF EXISTS evidence.claim_verification_request(uuid,uuid,uuid,varchar);
DROP FUNCTION IF EXISTS evidence.submit_verification_request(uuid,uuid,uuid,varchar);
DELETE FROM integration.schema_migrations WHERE migration_name='0620_v113_backend_evidence_verification';
COMMIT;
