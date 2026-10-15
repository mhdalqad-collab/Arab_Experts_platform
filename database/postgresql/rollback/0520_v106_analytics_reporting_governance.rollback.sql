BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM analytics.report_runs WHERE status_code IN ('PUBLISHED','EXPIRED'))
     OR EXISTS (SELECT 1 FROM analytics.metric_observations)
     OR EXISTS (SELECT 1 FROM analytics.metric_definition_versions WHERE approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback refused: governed metric observations, approved definitions, or published reports exist';
  END IF;
END $$;

DROP VIEW IF EXISTS analytics.v_report_publication_readiness;
DROP TABLE IF EXISTS analytics.report_runs;
DROP TABLE IF EXISTS analytics.report_definitions;
DROP TABLE IF EXISTS analytics.metric_observations;
DROP TABLE IF EXISTS analytics.metric_dimensions;
DROP TABLE IF EXISTS analytics.metric_definition_versions;
DROP TABLE IF EXISTS analytics.metric_definitions;
DROP SCHEMA IF EXISTS analytics;

COMMIT;
