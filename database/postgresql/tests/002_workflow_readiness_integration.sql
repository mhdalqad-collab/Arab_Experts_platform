\set ON_ERROR_STOP on

BEGIN;

SELECT service_case_workflow_version_id
FROM delivery.service_case_workflow_versions
WHERE workflow_code = 'SERVICE_CASE_STANDARD'
ORDER BY version_no DESC
LIMIT 1
\gset

SELECT delivery.assess_service_workflow_readiness(
  :'service_case_workflow_version_id'::uuid,
  30, 100, 0.02, 0.01, 0, 0, 0, NULL
) AS result
\gset

SELECT set_config(
  'eim.test_workflow_version_id',
  :'service_case_workflow_version_id',
  true
);
SELECT set_config('eim.test_readiness_result', :'result', true);

DO $$
DECLARE
  v_result jsonb :=
    current_setting('eim.test_readiness_result', true)::jsonb;
BEGIN
  IF v_result->>'status' <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'Readiness assessment did not complete';
  END IF;
  IF v_result->>'readiness' NOT IN (
    'INSUFFICIENT_DATA', 'NOT_READY', 'READY_FOR_REVIEW'
  ) THEN
    RAISE EXCEPTION 'Unexpected readiness result: %', v_result;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM delivery.service_case_workflow_versions
    WHERE service_case_workflow_version_id =
          current_setting('eim.test_workflow_version_id', true)::uuid
      AND enforcement_mode_code = 'ENFORCING'
  ) THEN
    RAISE EXCEPTION 'Readiness assessment must never activate ENFORCING';
  END IF;
END
$$;

ROLLBACK;
