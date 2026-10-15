BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM delivery.platform_deployments) THEN RAISE EXCEPTION 'Package T rollback refused: deployment history already exists'; END IF; END $$;
DROP FUNCTION IF EXISTS delivery.evaluate_production_deployment_gate(uuid);
DROP TABLE delivery.platform_deployments;
DROP TABLE delivery.platform_release_changes;
DROP TABLE delivery.platform_releases;
DROP TABLE delivery.platform_change_requests;
COMMIT;
