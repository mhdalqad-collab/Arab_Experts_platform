BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM delivery.service_workflow_rollout_recommendations
    WHERE safety_pause_applied
  ) THEN
    RAISE EXCEPTION
      'Package L rollback refused: safety actions have been recorded.';
  END IF;
END
$$;

DROP VIEW IF EXISTS delivery.v_service_workflow_rollout_latest_recommendation;
DROP FUNCTION IF EXISTS delivery.evaluate_service_workflow_rollout_window(
  uuid, uuid, varchar
);
DROP TABLE IF EXISTS delivery.service_workflow_rollout_recommendations;

ALTER TABLE delivery.service_workflow_rollout_windows
  DROP COLUMN IF EXISTS evaluated_at,
  DROP COLUMN IF EXISTS evaluated_by_party_id,
  DROP COLUMN IF EXISTS recommendation_code;

ALTER TABLE delivery.service_workflow_rollout_plans
  DROP COLUMN IF EXISTS minimum_window_attempts;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0310_v83_canary_metrics_recommendations';

COMMIT;
