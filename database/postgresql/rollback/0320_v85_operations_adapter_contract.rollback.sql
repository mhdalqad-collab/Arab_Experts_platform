BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM delivery.workflow_operations_command_receipts) THEN
    RAISE EXCEPTION 'Package N rollback refused: operations commands already exist';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS delivery.execute_workflow_operations_command(varchar,varchar,uuid,uuid,text,boolean,numeric,varchar);
DROP FUNCTION IF EXISTS delivery.get_workflow_operations_summary();
DROP TABLE delivery.workflow_operations_command_receipts;

COMMIT;
