BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM governance.ai_governance_decisions)
     OR EXISTS (SELECT 1 FROM governance.ai_model_monitoring_observations)
     OR EXISTS (
       SELECT 1 FROM governance.ai_model_evaluations
       WHERE evidence_refs <> '[]'::jsonb OR reviewed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Package AG rollback refused: AI governance evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS governance.v_ai_model_readiness;
DROP TABLE governance.ai_governance_decisions;
DROP TABLE governance.ai_model_monitoring_observations;
DROP TABLE governance.ai_model_evaluations;
DROP TABLE governance.ai_model_versions;
DROP TABLE governance.ai_systems;

COMMIT;
