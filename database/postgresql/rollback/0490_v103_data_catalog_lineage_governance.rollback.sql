BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM quality.data_lineage_edges)
     OR EXISTS (
       SELECT 1 FROM quality.data_lineage_impact_assessments
       WHERE approved_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Package AF rollback refused: governed lineage evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS quality.v_data_lineage_readiness;
DROP TABLE quality.data_lineage_impact_assessments;
DROP TABLE quality.data_lineage_edges;
DROP TABLE quality.data_lineage_nodes;
DROP TABLE quality.data_catalog_fields;
DROP TABLE quality.data_catalog_terms;

COMMIT;
