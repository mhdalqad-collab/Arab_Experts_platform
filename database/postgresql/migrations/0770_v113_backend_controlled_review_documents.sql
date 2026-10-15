BEGIN;

INSERT INTO governance.permissions(permission_code,name_ar,name_en,domain_code,action_code,resource_type,risk_level_code,requires_step_up_auth,requires_reason)
VALUES('professional.review.document','الوصول المقيد لوثائق مراجعة الملف المهني','Controlled access to professional review documents','PROFESSIONAL','REVIEW_DOCUMENT','professional_profile','CRITICAL',true,true)
ON CONFLICT(permission_code) DO UPDATE SET name_ar=excluded.name_ar,name_en=excluded.name_en,risk_level_code='CRITICAL',requires_step_up_auth=true,requires_reason=true,is_active=true;

INSERT INTO governance.role_permissions(role_id,permission_id,constraint_expression)
SELECT r.role_id,p.permission_id,'{"scope":"assigned_publication_review"}'::jsonb FROM governance.roles r CROSS JOIN governance.permissions p
WHERE r.role_code='PLATFORM_OPERATOR' AND p.permission_code='professional.review.document'
ON CONFLICT(role_id,permission_id,valid_from) DO NOTHING;

ALTER TABLE core.file_download_sessions
  ADD COLUMN IF NOT EXISTS publication_request_id uuid REFERENCES professional.profile_publication_requests(profile_publication_request_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS purpose_code varchar(60),
  ADD COLUMN IF NOT EXISTS access_reason text;

ALTER TABLE core.file_download_sessions DROP CONSTRAINT IF EXISTS ck_review_download_context;
ALTER TABLE core.file_download_sessions ADD CONSTRAINT ck_review_download_context CHECK(
  authorization_basis_code<>'ASSIGNED_PUBLICATION_REVIEWER'
  OR (publication_request_id IS NOT NULL AND purpose_code='PUBLICATION_REVIEW' AND length(btrim(access_reason)) BETWEEN 20 AND 1000)
);

CREATE INDEX IF NOT EXISTS idx_review_download_sessions
ON core.file_download_sessions(publication_request_id,requester_party_id,created_at DESC)
WHERE publication_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION professional.issue_review_document_download_session(
  p_session_id uuid,p_publication_request_id uuid,p_evidence_item_id uuid,p_file_id uuid,
  p_reviewer_party_id uuid,p_reviewer_user_account_id uuid,p_token_hash char(64),
  p_access_reason text,p_expires_at timestamptz,p_correlation_id varchar DEFAULT NULL
) RETURNS TABLE(storage_object_key text,original_file_name varchar,media_type varchar)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,evidence,professional,governance AS $$
DECLARE v_request professional.profile_publication_requests%ROWTYPE;v_file core.files%ROWTYPE;v_reason text:=btrim(p_access_reason);
BEGIN
  SELECT * INTO v_request FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_publication_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Publication review not found';END IF;
  IF v_request.status_code<>'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Publication review is not active';END IF;
  IF v_request.reviewer_party_id IS DISTINCT FROM p_reviewer_party_id OR v_request.requested_by_party_id=p_reviewer_party_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned reviewer access required';END IF;
  IF v_reason IS NULL OR length(v_reason) NOT BETWEEN 20 AND 1000 OR p_expires_at<=clock_timestamp() OR p_expires_at>clock_timestamp()+interval '3 minutes' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Invalid review document session';END IF;
  IF NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(coalesce(v_request.review_context_snapshot->'verifiedEvidenceSummaries','[]'::jsonb)) x
    WHERE x->>'evidenceItemId'=p_evidence_item_id::text
  ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Evidence is outside the frozen review context';END IF;
  SELECT f.* INTO v_file FROM evidence.evidence_files ef JOIN core.files f ON f.file_id=ef.file_id
  WHERE ef.evidence_item_id=p_evidence_item_id AND ef.file_id=p_file_id AND f.scan_status_code='SAFE' AND f.archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Safe review evidence file not found';END IF;
  INSERT INTO core.file_download_sessions(file_download_session_id,file_id,requester_party_id,token_hash_sha256,authorization_basis_code,expires_at,publication_request_id,purpose_code,access_reason)
  VALUES(p_session_id,p_file_id,p_reviewer_party_id,p_token_hash,'ASSIGNED_PUBLICATION_REVIEWER',p_expires_at,p_publication_request_id,'PUBLICATION_REVIEW',v_reason);
  PERFORM governance.append_audit_event('PROFESSIONAL','REVIEW_DOCUMENT_DOWNLOAD_AUTHORIZED',p_reviewer_party_id,p_reviewer_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_publication_request_id,p_correlation_id,'SUCCESS','CRITICAL','PUBLICATION_REVIEW',jsonb_build_object('download_session_id',p_session_id,'evidence_item_id',p_evidence_item_id,'file_id',p_file_id,'reason',v_reason,'expires_at',p_expires_at));
  RETURN QUERY SELECT v_file.storage_object_key,v_file.original_file_name,v_file.media_type;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0770_v113_backend_controlled_review_documents') ON CONFLICT DO NOTHING;
COMMIT;
