BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM governance.experiment_assignments)
    OR EXISTS(SELECT 1 FROM governance.controlled_experiments WHERE status_code IN('RUNNING','COMPLETED'))
    OR EXISTS(SELECT 1 FROM governance.feature_flag_rules WHERE environment_code='PRODUCTION')
    OR EXISTS(SELECT 1 FROM governance.configuration_versions WHERE environment_code='PRODUCTION')
 THEN RAISE EXCEPTION 'rollback refused: production configuration, rollout, or experiment evidence exists'; END IF;
END $$;
DROP VIEW IF EXISTS governance.v_feature_release_readiness;
DROP TABLE IF EXISTS governance.experiment_assignments;
DROP TABLE IF EXISTS governance.controlled_experiments;
DROP TABLE IF EXISTS governance.feature_flag_rules;
DROP TABLE IF EXISTS governance.feature_flags;
DROP TABLE IF EXISTS governance.configuration_versions;
DROP TABLE IF EXISTS governance.configuration_definitions;
COMMIT;
