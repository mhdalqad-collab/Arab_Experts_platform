BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM contract.contract_records
    WHERE legacy_source_table <> 'finance.contracts'
  ) OR EXISTS (
    SELECT 1 FROM rights.intellectual_assets
    WHERE legacy_source_table <> 'finance.ip_assets'
  ) OR EXISTS (
    SELECT 1 FROM quality.evaluations
    WHERE legacy_source_table <> 'evidence.ratings'
  ) OR EXISTS (
    SELECT 1 FROM quality.complaint_cases
    WHERE legacy_source_table <> 'evidence.complaints'
  ) OR EXISTS (
    SELECT 1 FROM quality.reputation_profiles
    WHERE legacy_source_table <> 'evidence.reputation_profiles'
  ) THEN
    RAISE EXCEPTION 'Package D rollback refused: target-native records exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM contract.contract_records t
    JOIN finance.contracts s ON s.contract_id = t.legacy_source_id
    WHERE t.source_snapshot <> to_jsonb(s)
  ) OR EXISTS (
    SELECT 1 FROM rights.intellectual_assets t
    JOIN finance.ip_assets s ON s.ip_asset_id = t.legacy_source_id
    WHERE t.source_snapshot <> to_jsonb(s)
  ) OR EXISTS (
    SELECT 1 FROM quality.evaluations t
    JOIN evidence.ratings s ON s.rating_id = t.legacy_source_id
    WHERE t.source_snapshot <> to_jsonb(s)
  ) OR EXISTS (
    SELECT 1 FROM quality.complaint_cases t
    JOIN evidence.complaints s ON s.complaint_id = t.legacy_source_id
    WHERE t.source_snapshot <> to_jsonb(s)
  ) OR EXISTS (
    SELECT 1 FROM quality.reputation_profiles t
    JOIN evidence.reputation_profiles s
      ON s.reputation_profile_id = t.legacy_source_id
    WHERE t.source_snapshot <> to_jsonb(s)
  ) THEN
    RAISE EXCEPTION 'Package D rollback refused: source records changed after the snapshot.';
  END IF;
END
$$;

DROP VIEW IF EXISTS quality.v_reputation_profiles_current;
DROP VIEW IF EXISTS quality.v_complaint_cases_current;
DROP VIEW IF EXISTS quality.v_evaluations_current;
DROP VIEW IF EXISTS rights.v_confidentiality_agreements_compat;
DROP VIEW IF EXISTS rights.v_ip_licenses_compat;
DROP VIEW IF EXISTS rights.v_ip_owners_compat;
DROP VIEW IF EXISTS rights.v_intellectual_assets_current;
DROP VIEW IF EXISTS contract.v_contract_signatures_compat;
DROP VIEW IF EXISTS contract.v_contract_versions_compat;
DROP VIEW IF EXISTS contract.v_contract_parties_compat;
DROP VIEW IF EXISTS contract.v_contracts_current;

DELETE FROM integration.data_reconciliation_runs
WHERE package_code = 'PACKAGE_D_V75';

DROP TABLE IF EXISTS quality.reputation_profiles;
DROP TABLE IF EXISTS quality.complaint_cases;
DROP TABLE IF EXISTS quality.evaluations;
DROP TABLE IF EXISTS rights.intellectual_assets;
DROP TABLE IF EXISTS contract.contract_records;

DELETE FROM integration.schema_migrations
WHERE migration_name = '0230_v75_contract_rights_quality_unification';

COMMIT;
