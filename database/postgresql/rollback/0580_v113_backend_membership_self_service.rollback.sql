BEGIN;
DROP FUNCTION IF EXISTS membership.submit_self_application(uuid, uuid, uuid, bigint, varchar);
DROP FUNCTION IF EXISTS membership.save_self_application_step(uuid, uuid, uuid, varchar, jsonb, boolean, bigint, varchar);
DROP FUNCTION IF EXISTS membership.create_self_application(uuid, uuid, varchar, varchar);
DELETE FROM integration.schema_migrations WHERE migration_name = '0580_v113_backend_membership_self_service';
COMMIT;
