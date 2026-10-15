BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM delivery.service_workflow_rollout_plans
    WHERE rollout_status_code IN ('CANARY_ACTIVE', 'FULL_ACTIVE')
  ) THEN
    RAISE EXCEPTION
      'Package J rollback refused: an enforcement rollout is active.';
  END IF;
END
$$;

DROP VIEW IF EXISTS delivery.v_service_workflow_rollout_control;

DROP FUNCTION IF EXISTS delivery.resolve_service_case_enforcement_mode(uuid, uuid);
DROP FUNCTION IF EXISTS delivery.trigger_service_workflow_kill_switch(
  uuid, uuid, text, varchar
);
DROP FUNCTION IF EXISTS delivery.apply_service_workflow_rollout_action(
  uuid, uuid, varchar, text, numeric, boolean, varchar
);
DROP FUNCTION IF EXISTS delivery.create_service_workflow_rollout_plan(
  uuid, uuid, uuid, numeric, integer, varchar
);

DROP TABLE IF EXISTS delivery.service_workflow_rollout_events;
DROP TABLE IF EXISTS delivery.service_workflow_rollout_windows;
DROP TABLE IF EXISTS delivery.service_workflow_rollout_plans;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0290_v81_workflow_rollout_control';

COMMIT;
