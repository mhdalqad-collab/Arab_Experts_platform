BEGIN;

CREATE TABLE core.file_upload_sessions (
  file_upload_session_id uuid PRIMARY KEY,
  file_id uuid NOT NULL UNIQUE REFERENCES core.files(file_id) ON DELETE CASCADE,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  token_hash_sha256 char(64) NOT NULL UNIQUE,
  expected_sha256 char(64) NOT NULL,
  expected_size_bytes bigint NOT NULL CHECK (expected_size_bytes BETWEEN 1 AND 10485760),
  expected_media_type varchar(160) NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'ISSUED'
    CHECK (status_code IN ('ISSUED','UPLOADED','SCANNING','COMPLETED','EXPIRED','CANCELLED')),
  expires_at timestamptz NOT NULL,
  uploaded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > created_at)
);
CREATE INDEX ix_file_upload_sessions_expiry ON core.file_upload_sessions(status_code, expires_at);
CREATE OR REPLACE FUNCTION core.register_file_upload_intent(
  p_session_id uuid, p_file_id uuid, p_owner_party_id uuid, p_token_hash char(64),
  p_storage_key text, p_original_name varchar, p_media_type varchar, p_size_bytes bigint,
  p_sha256 char(64), p_confidentiality varchar, p_expires_at timestamptz,
  p_user_account_id uuid, p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,governance AS $$
BEGIN
  IF p_media_type NOT IN ('application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
     OR p_size_bytes NOT BETWEEN 1 AND 10485760 OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR length(p_original_name)>240 OR nullif(btrim(p_original_name),'') IS NULL
     OR p_confidentiality NOT IN ('PUBLIC','ALLOWED_INFORMATION_ONLY','AUTHORIZED_CLIENTS','PLATFORM_ADMIN_ONLY')
     OR p_expires_at <= clock_timestamp() OR p_expires_at > clock_timestamp()+interval '15 minutes' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid upload intent';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_owner_party_id::text || ':' || p_sha256));
  IF EXISTS (SELECT 1 FROM core.files WHERE uploaded_by_party_id=p_owner_party_id AND sha256_hash=p_sha256 AND archived_at IS NULL AND scan_status_code<>'REJECTED') THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Duplicate active file';
  END IF;
  INSERT INTO core.files(file_id,storage_provider_code,storage_object_key,original_file_name,media_type,size_bytes,sha256_hash,scan_status_code,confidentiality_level_code,uploaded_by_party_id)
  VALUES(p_file_id,'PRIVATE_OBJECT_STORAGE',p_storage_key,btrim(p_original_name),p_media_type,p_size_bytes,p_sha256,'PENDING',p_confidentiality,p_owner_party_id);
  INSERT INTO core.file_upload_sessions(file_upload_session_id,file_id,owner_party_id,token_hash_sha256,expected_sha256,expected_size_bytes,expected_media_type,expires_at)
  VALUES(p_session_id,p_file_id,p_owner_party_id,p_token_hash,p_sha256,p_size_bytes,p_media_type,p_expires_at);
  PERFORM governance.append_audit_event('FILES','UPLOAD_INTENT_ISSUED',p_owner_party_id,p_user_account_id,'MEMBER_SELF','file',p_file_id,p_correlation_id,'SUCCESS','NORMAL','PRIVATE_UPLOAD',jsonb_build_object('size_bytes',p_size_bytes,'media_type',p_media_type,'confidentiality',p_confidentiality));
  RETURN p_file_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Duplicate active file or upload token';
END; $$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0600_v113_backend_secure_files') ON CONFLICT DO NOTHING;
COMMIT;
