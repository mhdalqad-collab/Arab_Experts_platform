BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM delivery.service_case_command_receipts
  ) OR EXISTS (
    SELECT 1 FROM delivery.service_case_transition_attempts
  ) OR EXISTS (
    SELECT 1 FROM delivery.service_case_transition_approvals
  ) OR EXISTS (
    SELECT 1 FROM delivery.service_case_transition_outbox_links
  ) THEN
    RAISE EXCEPTION
      'Package F rollback refused: runtime workflow records exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM delivery.service_case_workflow_versions
    WHERE workflow_code = 'SERVICE_CASE_STANDARD'
      AND version_no = 1
      AND (
        status_code <> 'DRAFT'
        OR enforcement_mode_code <> 'MONITOR_ONLY'
      )
  ) THEN
    RAISE EXCEPTION
      'Package F rollback refused: workflow was approved, activated, or enforced.';
  END IF;
END
$$;

DROP VIEW IF EXISTS delivery.v_service_case_workflow_monitor;
DROP VIEW IF EXISTS delivery.v_service_case_transition_readiness;

DROP TABLE IF EXISTS delivery.service_case_transition_outbox_links;
DROP TABLE IF EXISTS delivery.service_case_transition_approvals;
DROP TABLE IF EXISTS delivery.service_case_transition_attempts;
DROP TABLE IF EXISTS delivery.service_case_command_receipts;
DROP TABLE IF EXISTS delivery.service_case_transition_gate_requirements;
DROP TABLE IF EXISTS delivery.service_case_transition_roles;
DROP TABLE IF EXISTS delivery.service_case_transition_rules;
DROP TABLE IF EXISTS delivery.service_case_workflow_versions;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0250_v77_service_workflow_governance';

COMMIT;
