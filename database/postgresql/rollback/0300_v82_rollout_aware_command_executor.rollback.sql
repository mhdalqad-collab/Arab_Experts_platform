BEGIN;

DROP VIEW IF EXISTS delivery.v_service_case_enforcement_operations;

DROP FUNCTION IF EXISTS delivery.execute_service_case_command(
  uuid, uuid, varchar, varchar, varchar, bigint, text, boolean, varchar, jsonb
);

ALTER FUNCTION delivery.execute_service_case_command_v78(
  uuid, uuid, varchar, varchar, varchar, bigint, text, boolean, varchar, jsonb
) RENAME TO execute_service_case_command;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0300_v82_rollout_aware_command_executor';

COMMIT;
