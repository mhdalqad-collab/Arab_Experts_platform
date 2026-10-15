BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM delivery.workflow_incident_root_cause_analyses) OR EXISTS(SELECT 1 FROM delivery.workflow_incident_corrective_actions) OR EXISTS(SELECT 1 FROM delivery.workflow_incident_lessons) THEN RAISE EXCEPTION 'Package R rollback refused: incident resolution records already exist'; END IF; END $$;
DROP VIEW IF EXISTS delivery.v_workflow_incident_closure_readiness;
DROP FUNCTION IF EXISTS delivery.transition_workflow_operations_incident(uuid,uuid,varchar,text,uuid,boolean);
DROP TABLE delivery.workflow_incident_lessons;
DROP TABLE delivery.workflow_incident_corrective_actions;
DROP TABLE delivery.workflow_incident_root_cause_analyses;
COMMIT;
