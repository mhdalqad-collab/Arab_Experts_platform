BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM delivery.workflow_operations_approval_links) THEN RAISE EXCEPTION 'Package P rollback refused: operational approvals already exist'; END IF; END $$;
DROP FUNCTION IF EXISTS delivery.get_pending_workflow_operations_approvals();
DROP VIEW IF EXISTS delivery.v_pending_workflow_operations_approvals;
DROP FUNCTION IF EXISTS delivery.decide_workflow_operations_approval(uuid,uuid,varchar,text,boolean,varchar);
DROP FUNCTION IF EXISTS delivery.request_workflow_operations_approval(varchar,varchar,uuid,uuid,text,boolean,numeric,varchar);
DROP TABLE delivery.workflow_operations_approval_links;
COMMIT;
