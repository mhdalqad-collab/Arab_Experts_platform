BEGIN;
ALTER TABLE professional.training_experiences ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE professional.research_experiences ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),ADD COLUMN IF NOT EXISTS archived_at timestamptz;
DROP TRIGGER IF EXISTS trg_training_experiences_updated_at ON professional.training_experiences;CREATE TRIGGER trg_training_experiences_updated_at BEFORE UPDATE ON professional.training_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
DROP TRIGGER IF EXISTS trg_research_experiences_updated_at ON professional.research_experiences;CREATE TRIGGER trg_research_experiences_updated_at BEFORE UPDATE ON professional.research_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
ALTER TABLE professional.profile_record_versions DROP CONSTRAINT IF EXISTS profile_record_versions_record_type_code_check;
ALTER TABLE professional.profile_record_versions ADD CONSTRAINT profile_record_versions_record_type_code_check CHECK(record_type_code IN('ACADEMIC_QUALIFICATION','EMPLOYMENT_EXPERIENCE','PROJECT_EXPERIENCE','CONSULTING_EXPERIENCE','TRAINING_EXPERIENCE','RESEARCH_EXPERIENCE'));
INSERT INTO integration.schema_migrations(migration_name) VALUES('0700_v113_backend_training_research_experience') ON CONFLICT DO NOTHING;COMMIT;
