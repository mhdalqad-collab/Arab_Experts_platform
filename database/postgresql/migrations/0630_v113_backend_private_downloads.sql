BEGIN;

CREATE TABLE core.file_access_grants(
  file_access_grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE CASCADE,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  grantee_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  purpose_code varchar(60) NOT NULL,
  granted_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(owner_party_id<>grantee_party_id), CHECK(expires_at>starts_at)
);
CREATE UNIQUE INDEX uq_active_file_access_grant ON core.file_access_grants(file_id,grantee_party_id,purpose_code) WHERE revoked_at IS NULL;

CREATE TABLE core.file_download_sessions(
  file_download_session_id uuid PRIMARY KEY,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE CASCADE,
  requester_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  token_hash_sha256 char(64) NOT NULL UNIQUE,
  authorization_basis_code varchar(40) NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(expires_at>created_at)
);
CREATE INDEX ix_file_download_sessions_expiry ON core.file_download_sessions(expires_at) WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION core.grant_file_access(
  p_grant_id uuid,p_file_id uuid,p_owner_party_id uuid,p_grantee_party_id uuid,p_purpose_code varchar,
  p_expires_at timestamptz,p_user_account_id uuid,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,governance AS $$
BEGIN
  IF p_owner_party_id=p_grantee_party_id OR nullif(btrim(p_purpose_code),'') IS NULL OR length(p_purpose_code)>60 OR p_expires_at<=clock_timestamp() OR p_expires_at>clock_timestamp()+interval '90 days' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid file access grant'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.files WHERE file_id=p_file_id AND uploaded_by_party_id=p_owner_party_id AND archived_at IS NULL AND scan_status_code='SAFE') THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Safe owned file not found'; END IF;
  INSERT INTO core.file_access_grants(file_access_grant_id,file_id,owner_party_id,grantee_party_id,purpose_code,granted_by_party_id,expires_at)
  VALUES(p_grant_id,p_file_id,p_owner_party_id,p_grantee_party_id,upper(btrim(p_purpose_code)),p_owner_party_id,p_expires_at);
  PERFORM governance.append_audit_event('FILES','FILE_ACCESS_GRANTED',p_owner_party_id,p_user_account_id,'MEMBER_SELF','file',p_file_id,p_correlation_id,'SUCCESS','HIGH',upper(btrim(p_purpose_code)),jsonb_build_object('grant_id',p_grant_id,'grantee_party_id',p_grantee_party_id,'expires_at',p_expires_at));
  RETURN p_grant_id;
END; $$;

CREATE OR REPLACE FUNCTION core.issue_file_download_session(
  p_session_id uuid,p_file_id uuid,p_requester_party_id uuid,p_requester_user_account_id uuid,
  p_token_hash char(64),p_is_verifier boolean,p_is_platform_admin boolean,p_expires_at timestamptz,p_correlation_id varchar DEFAULT NULL
) RETURNS TABLE(allowed boolean,authorization_basis_code varchar,storage_object_key text,original_file_name varchar,media_type varchar)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,core,evidence,governance AS $$
DECLARE v_file core.files%ROWTYPE; v_basis varchar(40); v_verified boolean:=false;
BEGIN
  SELECT * INTO v_file FROM core.files WHERE file_id=p_file_id AND archived_at IS NULL;
  IF NOT FOUND OR v_file.scan_status_code<>'SAFE' OR p_expires_at<=clock_timestamp() OR p_expires_at>clock_timestamp()+interval '5 minutes' THEN
    IF FOUND THEN PERFORM governance.append_audit_event('FILES','FILE_DOWNLOAD_DENIED',p_requester_party_id,p_requester_user_account_id,NULL,'file',p_file_id,p_correlation_id,'DENIED','HIGH','FILE_NOT_SAFE_OR_SESSION_INVALID','{}'::jsonb); END IF;
    RETURN QUERY SELECT false,NULL::varchar,NULL::text,NULL::varchar,NULL::varchar; RETURN;
  END IF;
  SELECT EXISTS(SELECT 1 FROM evidence.evidence_files ef JOIN evidence.evidence_items e ON e.evidence_item_id=ef.evidence_item_id WHERE ef.file_id=p_file_id AND e.status_code='VERIFIED') INTO v_verified;
  v_basis:=CASE
    WHEN v_file.uploaded_by_party_id=p_requester_party_id THEN 'OWNER'
    WHEN p_is_platform_admin THEN 'PLATFORM_ADMIN'
    WHEN p_is_verifier THEN 'EVIDENCE_VERIFIER'
    WHEN v_file.confidentiality_level_code='PUBLIC' AND v_verified THEN 'VERIFIED_PUBLIC'
    WHEN v_file.confidentiality_level_code='AUTHORIZED_CLIENTS' AND EXISTS(SELECT 1 FROM core.file_access_grants g WHERE g.file_id=p_file_id AND g.grantee_party_id=p_requester_party_id AND g.starts_at<=clock_timestamp() AND g.expires_at>clock_timestamp() AND g.revoked_at IS NULL) THEN 'EXPLICIT_GRANT'
    ELSE NULL END;
  IF v_basis IS NULL THEN
    PERFORM governance.append_audit_event('FILES','FILE_DOWNLOAD_DENIED',p_requester_party_id,p_requester_user_account_id,NULL,'file',p_file_id,p_correlation_id,'DENIED','HIGH','CONFIDENTIALITY_POLICY','{}'::jsonb);
    RETURN QUERY SELECT false,NULL::varchar,NULL::text,NULL::varchar,NULL::varchar; RETURN;
  END IF;
  INSERT INTO core.file_download_sessions(file_download_session_id,file_id,requester_party_id,token_hash_sha256,authorization_basis_code,expires_at)
  VALUES(p_session_id,p_file_id,p_requester_party_id,p_token_hash,v_basis,p_expires_at);
  PERFORM governance.append_audit_event('FILES','FILE_DOWNLOAD_AUTHORIZED',p_requester_party_id,p_requester_user_account_id,NULL,'file',p_file_id,p_correlation_id,'SUCCESS','HIGH',v_basis,jsonb_build_object('download_session_id',p_session_id,'expires_at',p_expires_at));
  RETURN QUERY SELECT true,v_basis,v_file.storage_object_key,v_file.original_file_name,v_file.media_type;
END; $$;

CREATE OR REPLACE FUNCTION core.consume_file_download_session(p_session_id uuid,p_token_hash char(64)) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,core AS $$
DECLARE v_session core.file_download_sessions%ROWTYPE;v_key text;
BEGIN
  SELECT * INTO v_session FROM core.file_download_sessions WHERE file_download_session_id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.consumed_at IS NOT NULL OR v_session.expires_at<=clock_timestamp() OR v_session.token_hash_sha256<>p_token_hash THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Download session invalid'; END IF;
  UPDATE core.file_download_sessions SET consumed_at=clock_timestamp() WHERE file_download_session_id=p_session_id;
  SELECT storage_object_key INTO v_key FROM core.files WHERE file_id=v_session.file_id AND scan_status_code='SAFE' AND archived_at IS NULL;
  IF v_key IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='File unavailable'; END IF;
  RETURN v_key;
END; $$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0630_v113_backend_private_downloads') ON CONFLICT DO NOTHING;
COMMIT;
