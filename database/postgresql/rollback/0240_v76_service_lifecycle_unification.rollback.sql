BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM delivery.service_cases
    WHERE legacy_source_table <> 'needs.service_requests'
  ) THEN
    RAISE EXCEPTION 'Package E rollback refused: target-native service cases exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM delivery.service_case_links WHERE source_code <> 'BACKFILL'
  ) OR EXISTS (
    SELECT 1 FROM delivery.service_case_gates
  ) OR EXISTS (
    SELECT 1 FROM delivery.service_case_exceptions
  ) OR EXISTS (
    SELECT 1 FROM delivery.service_case_stage_events
    WHERE source_event_table IS DISTINCT FROM 'needs.service_request_status_history'
  ) THEN
    RAISE EXCEPTION 'Package E rollback refused: post-backfill orchestration data exists.';
  END IF;
END
$$;

DROP VIEW IF EXISTS delivery.v_service_case_traceability;
DROP VIEW IF EXISTS delivery.v_service_case_timeline;

DELETE FROM integration.data_reconciliation_runs
WHERE package_code = 'PACKAGE_E_V76';

DROP TABLE IF EXISTS delivery.service_case_exceptions;
DROP TABLE IF EXISTS delivery.service_case_gates;
DROP TABLE IF EXISTS delivery.service_case_stage_events;
DROP TABLE IF EXISTS delivery.service_case_links;
DROP TABLE IF EXISTS delivery.service_cases;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0240_v76_service_lifecycle_unification';

COMMIT;
