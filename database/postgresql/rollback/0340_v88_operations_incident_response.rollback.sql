BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM delivery.workflow_operations_incidents) THEN RAISE EXCEPTION 'Package Q rollback refused: operational incidents already exist'; END IF; END $$;
DROP VIEW IF EXISTS delivery.v_workflow_operations_incident_queue;
DROP FUNCTION IF EXISTS delivery.escalate_overdue_workflow_operations_incidents();
DROP FUNCTION IF EXISTS delivery.raise_workflow_operations_incident(varchar,varchar,varchar,uuid,varchar,text,varchar,jsonb);
DROP TABLE delivery.workflow_operations_incident_events;
DROP TABLE delivery.workflow_operations_incidents;
COMMIT;
