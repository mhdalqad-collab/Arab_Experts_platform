BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM quality.data_quality_results)
     OR EXISTS (
       SELECT 1 FROM quality.data_quality_issues
       WHERE resolution_evidence_refs <> '[]'::jsonb OR verified_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Package AE rollback refused: data quality evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS quality.v_data_product_quality_posture;
DROP TABLE quality.data_quality_issues;
DROP TABLE quality.data_quality_results;
DROP TABLE quality.data_quality_runs;
DROP TABLE quality.data_quality_rules;
DROP TABLE quality.data_products;

COMMIT;
