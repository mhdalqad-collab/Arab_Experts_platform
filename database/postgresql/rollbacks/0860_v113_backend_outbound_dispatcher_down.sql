BEGIN;
DROP FUNCTION IF EXISTS communication.record_outbound_delivery_result(uuid,varchar,varchar,varchar,text,varchar,varchar);
DROP FUNCTION IF EXISTS communication.claim_outbound_messages(varchar,integer);
DROP INDEX IF EXISTS communication.idx_outbound_dispatch_claim;
ALTER TABLE communication.outbound_messages DROP COLUMN IF EXISTS claim_count,DROP COLUMN IF EXISTS claimed_at,DROP COLUMN IF EXISTS lease_expires_at,DROP COLUMN IF EXISTS lease_token_hash;
DELETE FROM integration.schema_migrations WHERE migration_name='0860_v113_backend_outbound_dispatcher';
COMMIT;
