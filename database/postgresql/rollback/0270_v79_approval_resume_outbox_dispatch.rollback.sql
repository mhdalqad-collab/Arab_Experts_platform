BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM integration.outbox_dispatch_leases
    WHERE lease_status_code IN ('PUBLISHED', 'DEAD_LETTER')
  ) OR EXISTS (
    SELECT 1
    FROM delivery.service_case_transition_attempts
    WHERE executed_at IS NOT NULL
      AND service_case_command_receipt_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Package H rollback refused: approvals or outbox dispatches have processed runtime work.';
  END IF;
END
$$;

DROP VIEW IF EXISTS integration.v_outbox_dispatch_operations;

DROP FUNCTION IF EXISTS governance.decide_service_case_transition_approval(
  uuid, uuid, varchar, text, varchar
);
DROP FUNCTION IF EXISTS delivery.resume_approved_service_case_transition(
  uuid, varchar
);
DROP FUNCTION IF EXISTS integration.complete_outbox_dispatch(
  uuid, boolean, text, jsonb, integer
);
DROP FUNCTION IF EXISTS integration.claim_outbox_events(
  varchar, integer, integer
);

DROP TABLE IF EXISTS integration.outbox_dispatch_leases;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0270_v79_approval_resume_outbox_dispatch';

COMMIT;
