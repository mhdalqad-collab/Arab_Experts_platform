BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM governance.data_disposition_items
    WHERE result_code IN ('SUCCEEDED','FAILED','BLOCKED_BY_HOLD')
  ) THEN
    RAISE EXCEPTION 'Package Y rollback refused: disposition execution evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS governance.v_data_disposition_readiness;
DROP TABLE governance.data_disposition_items;
DROP TABLE governance.data_disposition_batches;
DROP TABLE governance.data_disposition_assessments;
DROP TABLE governance.data_retention_targets;

COMMIT;
