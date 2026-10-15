BEGIN;
DROP TABLE IF EXISTS professional.profile_record_versions;
DROP TRIGGER IF EXISTS trg_qualifications_updated_at ON professional.academic_qualifications;CREATE TRIGGER trg_qualifications_updated_at BEFORE UPDATE ON professional.academic_qualifications FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS trg_employment_updated_at ON professional.employment_experiences;CREATE TRIGGER trg_employment_updated_at BEFORE UPDATE ON professional.employment_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
ALTER TABLE professional.academic_qualifications DROP COLUMN IF EXISTS archived_at,DROP COLUMN IF EXISTS row_version;
ALTER TABLE professional.employment_experiences DROP COLUMN IF EXISTS archived_at,DROP COLUMN IF EXISTS row_version;
DELETE FROM integration.schema_migrations WHERE migration_name='0680_v113_backend_qualification_employment';COMMIT;
