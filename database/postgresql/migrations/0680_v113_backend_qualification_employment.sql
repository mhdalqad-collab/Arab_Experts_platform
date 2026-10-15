BEGIN;
ALTER TABLE professional.academic_qualifications ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE professional.employment_experiences ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),ADD COLUMN IF NOT EXISTS archived_at timestamptz;
DROP TRIGGER IF EXISTS trg_qualifications_updated_at ON professional.academic_qualifications;
DROP TRIGGER IF EXISTS trg_employment_updated_at ON professional.employment_experiences;
CREATE TRIGGER trg_qualifications_updated_at BEFORE UPDATE ON professional.academic_qualifications FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_employment_updated_at BEFORE UPDATE ON professional.employment_experiences FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TABLE professional.profile_record_versions(
 profile_record_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),professional_profile_id uuid NOT NULL REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
 record_type_code varchar(40) NOT NULL CHECK(record_type_code IN('ACADEMIC_QUALIFICATION','EMPLOYMENT_EXPERIENCE')),record_id uuid NOT NULL,version_no bigint NOT NULL CHECK(version_no>0),snapshot_json jsonb NOT NULL,change_action_code varchar(20) NOT NULL CHECK(change_action_code IN('CREATED','UPDATED','ARCHIVED')),changed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),change_summary text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(record_type_code,record_id,version_no)
);
CREATE INDEX idx_profile_record_history ON professional.profile_record_versions(record_type_code,record_id,version_no DESC);
INSERT INTO integration.schema_migrations(migration_name) VALUES('0680_v113_backend_qualification_employment') ON CONFLICT DO NOTHING;
COMMIT;
