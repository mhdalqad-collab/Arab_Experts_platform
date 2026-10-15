BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM integration.platform_vendor_dependencies) OR EXISTS(SELECT 1 FROM integration.platform_vendor_assessments) THEN RAISE EXCEPTION 'Package X rollback refused: vendor governance evidence already exists'; END IF; END $$;
DROP VIEW IF EXISTS integration.v_platform_vendor_readiness;
DROP TABLE integration.platform_vendor_assessments;
DROP TABLE integration.platform_vendor_slas;
DROP TABLE integration.platform_vendor_dependencies;
DROP TABLE integration.platform_vendors;
COMMIT;
