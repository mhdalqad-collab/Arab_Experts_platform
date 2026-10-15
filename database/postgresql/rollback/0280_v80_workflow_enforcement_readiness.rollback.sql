BEGIN;

DROP VIEW IF EXISTS delivery.v_service_workflow_latest_readiness;

DROP FUNCTION IF EXISTS delivery.assess_service_workflow_readiness(
  uuid, integer, integer, numeric, numeric, integer, integer, integer, uuid
);

DROP TABLE IF EXISTS delivery.service_workflow_readiness_assessments;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0280_v80_workflow_enforcement_readiness';

COMMIT;
