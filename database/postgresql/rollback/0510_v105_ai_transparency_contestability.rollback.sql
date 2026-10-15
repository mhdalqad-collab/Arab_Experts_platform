BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM governance.ai_decision_contests)
     OR EXISTS (SELECT 1 FROM governance.ai_human_override_records)
     OR EXISTS (SELECT 1 FROM governance.ai_decision_incidents)
     OR EXISTS (SELECT 1 FROM governance.ai_decision_notices WHERE delivered_at IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback refused: AI notices, contests, overrides, or incident evidence exists';
  END IF;
END $$;

DROP VIEW IF EXISTS governance.v_ai_decision_due_process;
DROP TABLE IF EXISTS governance.ai_decision_incidents;
DROP TABLE IF EXISTS governance.ai_decision_contests;
DROP TABLE IF EXISTS governance.ai_human_override_records;
DROP TABLE IF EXISTS governance.ai_decision_notices;
DROP TABLE IF EXISTS governance.ai_decision_explanations;

COMMIT;
