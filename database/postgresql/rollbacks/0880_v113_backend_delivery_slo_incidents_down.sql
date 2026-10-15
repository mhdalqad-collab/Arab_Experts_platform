BEGIN;
DROP FUNCTION IF EXISTS communication.resolve_delivery_operations_incident(uuid,uuid,uuid,varchar,text,varchar);
DROP FUNCTION IF EXISTS communication.evaluate_delivery_slos(uuid,uuid,timestamptz,varchar);
DROP TABLE IF EXISTS communication.delivery_operations_incidents;
DROP TABLE IF EXISTS communication.delivery_slo_measurements;
DROP TABLE IF EXISTS communication.delivery_slo_policies;
DELETE FROM integration.schema_migrations WHERE migration_name='0880_v113_backend_delivery_slo_incidents';
COMMIT;
