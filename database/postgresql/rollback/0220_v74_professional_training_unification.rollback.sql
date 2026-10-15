\set ON_ERROR_STOP on

BEGIN;

-- Refuse rollback after target-native content or a human duplicate decision.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM training.course_contents
    WHERE legacy_course_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM training.course_content_duplicate_candidates
    WHERE status_code <> 'PENDING_REVIEW'
  ) OR EXISTS (
    SELECT 1
    FROM professional.experience_records
    WHERE legacy_source_table IS NOT NULL
      AND updated_at <> created_at
  )
  THEN
    RAISE EXCEPTION
      'Rollback refused: Package C contains native content, review decisions, or edited backfills.';
  END IF;
END;
$$;

DROP VIEW training.v_course_contents_current;
DROP VIEW professional.v_unified_experience_records;

DELETE FROM integration.data_reconciliation_runs
WHERE package_code = 'PACKAGE_C';

DROP TABLE training.course_content_duplicate_candidates;
DROP TABLE training.course_content_fingerprints;
DROP TABLE training.course_offering_content_links;
DROP TABLE training.course_content_version_names;
ALTER TABLE training.course_contents
  DROP CONSTRAINT fk_course_content_current_version;
DROP TABLE training.course_content_versions;
DROP TABLE training.course_contents;

DELETE FROM professional.experience_records
WHERE legacy_source_table IN (
  'professional.employment_experiences',
  'professional.project_experiences',
  'professional.training_experiences',
  'professional.consulting_experiences',
  'professional.research_experiences'
);

-- The additive snapshot columns and generic reconciliation tables remain
-- available because removing them could discard data from later packages.

DELETE FROM integration.schema_migrations
WHERE migration_name = '0220_v74_professional_training_unification';

COMMIT;
