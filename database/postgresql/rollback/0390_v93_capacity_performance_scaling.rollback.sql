BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM delivery.platform_capacity_metrics)
 OR EXISTS(SELECT 1 FROM delivery.platform_load_tests) THEN
  RAISE EXCEPTION 'Package V rollback refused: capacity evidence already exists';
 END IF;
END $$;
DROP FUNCTION IF EXISTS delivery.evaluate_platform_capacity_gate(uuid);
DROP VIEW IF EXISTS delivery.v_platform_capacity_readiness;
DROP TABLE delivery.platform_scaling_policies;
DROP TABLE delivery.platform_load_tests;
DROP TABLE delivery.platform_capacity_metrics;
DROP TABLE delivery.platform_capacity_plans;
COMMIT;
