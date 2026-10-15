\set ON_ERROR_STOP on

BEGIN;

-- This rollback deliberately refuses to drop Package A after business data
-- exists. It is safe only immediately after an empty foundation deployment.
DO $$
DECLARE
  populated_table text;
BEGIN
  FOR populated_table IN
    SELECT table_name
    FROM (VALUES
      ('professional.experience_records'),
      ('taxonomy.concept_status_history'),
      ('taxonomy.mapping_decisions'),
      ('contract.contract_amendments'),
      ('contract.contract_amendment_files'),
      ('delivery.project_baselines'),
      ('delivery.acceptance_criteria'),
      ('delivery.progress_reports'),
      ('delivery.project_contributions'),
      ('rights.disclosure_records'),
      ('rights.information_use_restrictions'),
      ('finance.ledger_accounts'),
      ('finance.ledger_transactions'),
      ('finance.ledger_entries'),
      ('finance.revenue_shares'),
      ('quality.reputation_model_versions'),
      ('quality.corrective_actions'),
      ('quality.corrective_action_evidence'),
      ('governance.access_decisions'),
      ('governance.automated_decision_records')
    ) AS package_a(table_name)
    WHERE CASE table_name
      WHEN 'professional.experience_records'
        THEN EXISTS (SELECT 1 FROM professional.experience_records)
      WHEN 'taxonomy.concept_status_history'
        THEN EXISTS (SELECT 1 FROM taxonomy.concept_status_history)
      WHEN 'taxonomy.mapping_decisions'
        THEN EXISTS (SELECT 1 FROM taxonomy.mapping_decisions)
      WHEN 'contract.contract_amendments'
        THEN EXISTS (SELECT 1 FROM contract.contract_amendments)
      WHEN 'contract.contract_amendment_files'
        THEN EXISTS (SELECT 1 FROM contract.contract_amendment_files)
      WHEN 'delivery.project_baselines'
        THEN EXISTS (SELECT 1 FROM delivery.project_baselines)
      WHEN 'delivery.acceptance_criteria'
        THEN EXISTS (SELECT 1 FROM delivery.acceptance_criteria)
      WHEN 'delivery.progress_reports'
        THEN EXISTS (SELECT 1 FROM delivery.progress_reports)
      WHEN 'delivery.project_contributions'
        THEN EXISTS (SELECT 1 FROM delivery.project_contributions)
      WHEN 'rights.disclosure_records'
        THEN EXISTS (SELECT 1 FROM rights.disclosure_records)
      WHEN 'rights.information_use_restrictions'
        THEN EXISTS (SELECT 1 FROM rights.information_use_restrictions)
      WHEN 'finance.ledger_accounts'
        THEN EXISTS (SELECT 1 FROM finance.ledger_accounts)
      WHEN 'finance.ledger_transactions'
        THEN EXISTS (SELECT 1 FROM finance.ledger_transactions)
      WHEN 'finance.ledger_entries'
        THEN EXISTS (SELECT 1 FROM finance.ledger_entries)
      WHEN 'finance.revenue_shares'
        THEN EXISTS (SELECT 1 FROM finance.revenue_shares)
      WHEN 'quality.reputation_model_versions'
        THEN EXISTS (SELECT 1 FROM quality.reputation_model_versions)
      WHEN 'quality.corrective_actions'
        THEN EXISTS (SELECT 1 FROM quality.corrective_actions)
      WHEN 'quality.corrective_action_evidence'
        THEN EXISTS (SELECT 1 FROM quality.corrective_action_evidence)
      WHEN 'governance.access_decisions'
        THEN EXISTS (SELECT 1 FROM governance.access_decisions)
      WHEN 'governance.automated_decision_records'
        THEN EXISTS (SELECT 1 FROM governance.automated_decision_records)
    END
  LOOP
    RAISE EXCEPTION
      'Rollback refused: Package A table % contains data.', populated_table;
  END LOOP;
END;
$$;

DROP TABLE governance.automated_decision_records;
DROP TABLE governance.access_decisions;
DROP TABLE quality.corrective_action_evidence;
DROP TABLE quality.corrective_actions;
DROP TABLE quality.reputation_model_versions;
DROP TABLE finance.revenue_shares;
DROP TABLE finance.ledger_entries;
DROP TABLE finance.ledger_transactions;
DROP TABLE finance.ledger_accounts;
DROP TABLE rights.information_use_restrictions;
DROP TABLE rights.disclosure_records;
DROP TABLE delivery.project_contributions;
DROP TABLE delivery.progress_reports;
DROP TABLE delivery.acceptance_criteria;
DROP TABLE delivery.project_baselines;
DROP TABLE contract.contract_amendment_files;
DROP TABLE contract.contract_amendments;
DROP TABLE taxonomy.mapping_decisions;
DROP TABLE taxonomy.concept_status_history;
DROP TABLE professional.experience_records;

DROP SCHEMA quality;
DROP SCHEMA rights;
DROP SCHEMA contract;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0200_v71_foundation_non_destructive';

COMMIT;
