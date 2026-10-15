BEGIN;

CREATE INDEX IF NOT EXISTS idx_fingerprint_versions_history
  ON professional.fingerprint_versions(professional_fingerprint_id,version_no DESC);

INSERT INTO integration.schema_migrations(migration_name)
VALUES('0660_v113_backend_professional_profile') ON CONFLICT DO NOTHING;
COMMIT;
