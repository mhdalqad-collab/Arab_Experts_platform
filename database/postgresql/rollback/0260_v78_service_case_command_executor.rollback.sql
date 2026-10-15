BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM delivery.service_case_command_receipts
    WHERE completed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM delivery.service_case_transition_attempts
    WHERE executed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Package G rollback refused: the command executor has processed runtime commands.';
  END IF;
END
$$;

DROP VIEW IF EXISTS delivery.v_service_case_command_operations;

DROP FUNCTION IF EXISTS delivery.execute_service_case_command(
  uuid, uuid, varchar, varchar, varchar, bigint, text, boolean, varchar, jsonb
);

DELETE FROM integration.schema_migrations
WHERE migration_name = '0260_v78_service_case_command_executor';

COMMIT;
