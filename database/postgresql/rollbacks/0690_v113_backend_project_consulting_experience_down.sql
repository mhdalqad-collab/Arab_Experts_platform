BEGIN;
ALTER TABLE professional.profile_record_versions DROP CONSTRAINT IF EXISTS profile_record_versions_record_type_code_check;ALTER TABLE professional.profile_record_versions ADD CONSTRAINT profile_record_versions_record_type_code_check CHECK(record_type_code IN('ACADEMIC_QUALIFICATION','EMPLOYMENT_EXPERIENCE'));
DROP TRIGGER IF EXISTS trg_project_experiences_updated_at ON professional.project_experiences;CREATE TRIGGER trg_project_experiences_updated_at BEFORE UPDATE ON professional.project_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS trg_consulting_experiences_updated_at ON professional.consulting_experiences;CREATE TRIGGER trg_consulting_experiences_updated_at BEFORE UPDATE ON professional.consulting_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
ALTER TABLE professional.project_experiences DROP COLUMN IF EXISTS archived_at,DROP COLUMN IF EXISTS row_version;ALTER TABLE professional.consulting_experiences DROP COLUMN IF EXISTS archived_at,DROP COLUMN IF EXISTS row_version;
DELETE FROM integration.schema_migrations WHERE migration_name='0690_v113_backend_project_consulting_experience';COMMIT;
