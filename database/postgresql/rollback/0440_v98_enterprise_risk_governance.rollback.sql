BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM governance.enterprise_risk_assessments
    WHERE evidence_refs <> '[]'::jsonb OR approved_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM governance.enterprise_risk_treatment_plans
    WHERE completion_evidence_refs <> '[]'::jsonb OR effectiveness_verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Package AA rollback refused: governed risk evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS governance.v_enterprise_risk_posture;
DROP TABLE governance.enterprise_risk_indicators;
DROP TABLE governance.enterprise_risk_treatment_plans;
DROP TABLE governance.enterprise_risk_control_links;
DROP TABLE governance.enterprise_risk_assessments;
DROP TABLE governance.enterprise_risks;

COMMIT;
