BEGIN;
ALTER TABLE professional.project_experiences ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE professional.consulting_experiences ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),ADD COLUMN IF NOT EXISTS archived_at timestamptz;
DROP TRIGGER IF EXISTS trg_project_experiences_updated_at ON professional.project_experiences;CREATE TRIGGER trg_project_experiences_updated_at BEFORE UPDATE ON professional.project_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
DROP TRIGGER IF EXISTS trg_consulting_experiences_updated_at ON professional.consulting_experiences;CREATE TRIGGER trg_consulting_experiences_updated_at BEFORE UPDATE ON professional.consulting_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
ALTER TABLE professional.profile_record_versions DROP CONSTRAINT IF EXISTS profile_record_versions_record_type_code_check;
ALTER TABLE professional.profile_record_versions ADD CONSTRAINT profile_record_versions_record_type_code_check CHECK(record_type_code IN('ACADEMIC_QUALIFICATION','EMPLOYMENT_EXPERIENCE','PROJECT_EXPERIENCE','CONSULTING_EXPERIENCE'));
INSERT INTO integration.schema_migrations(migration_name) VALUES('0690_v113_backend_project_consulting_experience') ON CONFLICT DO NOTHING;COMMIT;
