BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM delivery.workflow_reliability_measurements) THEN RAISE EXCEPTION 'Package S rollback refused: reliability measurements already exist'; END IF; END $$;
DROP VIEW IF EXISTS delivery.v_workflow_reliability_dashboard;
DROP VIEW IF EXISTS delivery.v_workflow_reliability_incident_metrics;
DROP TABLE delivery.workflow_reliability_budget_events;
DROP TABLE delivery.workflow_reliability_measurements;
DROP TABLE delivery.workflow_reliability_objectives;
COMMIT;
