\set ON_ERROR_STOP on

BEGIN;

-- Rollback is allowed only before any human review or merge plan exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM core.party_merge_reviews)
     OR EXISTS (SELECT 1 FROM core.party_merge_field_decisions)
     OR EXISTS (SELECT 1 FROM core.party_merge_plans)
     OR EXISTS (SELECT 1 FROM core.party_merge_events)
  THEN
    RAISE EXCEPTION
      'Rollback refused: Package B contains human decisions or merge plans.';
  END IF;
END;
$$;

DROP VIEW crm.v_client_canonical_identity;
DROP VIEW core.v_party_duplicate_review_queue;
DROP TABLE crm.client_identity_resolution_runs;
DROP TABLE crm.client_contact_roles;
DROP TABLE crm.client_identity_links;
DROP TABLE core.party_merge_events;
DROP TABLE core.party_merge_plans;
DROP TABLE core.party_merge_field_decisions;
DROP TABLE core.party_merge_reviews;
DROP TABLE core.party_duplicate_candidates;
DROP TABLE core.party_match_keys;
DROP FUNCTION core.normalize_match_text(text);

DELETE FROM integration.schema_migrations
WHERE migration_name = '0210_v73_client_identity_resolution';

COMMIT;
