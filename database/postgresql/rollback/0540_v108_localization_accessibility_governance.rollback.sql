BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM localization.translation_versions WHERE quality_status_code = 'APPROVED')
     OR EXISTS (SELECT 1 FROM localization.content_localizations WHERE status_code = 'PUBLISHED')
     OR EXISTS (SELECT 1 FROM localization.accessibility_assessments) THEN
    RAISE EXCEPTION 'rollback refused: approved translations, published localizations, or accessibility evidence exists';
  END IF;
END $$;

DROP VIEW IF EXISTS localization.v_localization_release_readiness;
DROP TABLE IF EXISTS localization.accessibility_assessments;
DROP TABLE IF EXISTS localization.accessibility_requirements;
DROP TABLE IF EXISTS localization.content_localizations;
DROP TABLE IF EXISTS localization.translation_versions;
DROP TABLE IF EXISTS localization.resource_keys;
DROP TABLE IF EXISTS localization.locales;
DROP SCHEMA IF EXISTS localization;

COMMIT;
