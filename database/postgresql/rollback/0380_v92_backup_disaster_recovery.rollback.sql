BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM delivery.platform_backup_runs)
 OR EXISTS(SELECT 1 FROM delivery.platform_recovery_exercises) THEN
  RAISE EXCEPTION 'Package U rollback refused: continuity evidence already exists';
 END IF;
END $$;
DROP FUNCTION IF EXISTS delivery.evaluate_platform_failover_gate(uuid);
DROP VIEW IF EXISTS delivery.v_platform_continuity_readiness;
DROP TABLE delivery.platform_recovery_exercises;
DROP TABLE delivery.platform_backup_runs;
DROP TABLE delivery.platform_continuity_plans;
COMMIT;
