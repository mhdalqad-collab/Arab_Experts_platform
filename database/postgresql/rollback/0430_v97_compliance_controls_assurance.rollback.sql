BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM governance.compliance_control_tests
    WHERE evidence_refs <> '[]'::jsonb OR reviewed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Package Z rollback refused: compliance assurance evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS governance.v_compliance_control_posture;
DROP TABLE governance.compliance_control_tests;
DROP TABLE governance.compliance_control_mappings;
DROP TABLE governance.compliance_controls;
DROP TABLE governance.compliance_obligations;
DROP TABLE governance.compliance_frameworks;

COMMIT;
