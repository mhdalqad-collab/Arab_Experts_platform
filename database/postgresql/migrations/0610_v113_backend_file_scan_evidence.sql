BEGIN;

CREATE OR REPLACE FUNCTION core.confirm_file_upload(
  p_session_id uuid,p_token_hash char(64),p_actual_sha256 char(64),
  p_actual_size_bytes bigint,p_actual_media_type varchar,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,governance AS $$
DECLARE v_session core.file_upload_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM core.file_upload_sessions WHERE file_upload_session_id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Upload session not found'; END IF;
  IF v_session.status_code<>'ISSUED' OR v_session.expires_at<=clock_timestamp() THEN
    UPDATE core.file_upload_sessions SET status_code='EXPIRED' WHERE file_upload_session_id=p_session_id AND status_code='ISSUED';
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Upload session is not active';
  END IF;
  IF v_session.token_hash_sha256<>p_token_hash OR v_session.expected_sha256<>p_actual_sha256
     OR v_session.expected_size_bytes<>p_actual_size_bytes OR v_session.expected_media_type<>p_actual_media_type THEN
    UPDATE core.files SET scan_status_code='QUARANTINED' WHERE file_id=v_session.file_id;
    UPDATE core.file_upload_sessions SET status_code='CANCELLED' WHERE file_upload_session_id=p_session_id;
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Uploaded object metadata mismatch';
  END IF;
  UPDATE core.file_upload_sessions SET status_code='SCANNING',uploaded_at=clock_timestamp() WHERE file_upload_session_id=p_session_id;
  UPDATE core.files SET scan_status_code='SCANNING' WHERE file_id=v_session.file_id;
  PERFORM governance.append_audit_event('FILES','UPLOAD_CONFIRMED',v_session.owner_party_id,NULL,'STORAGE_GATEWAY','file',v_session.file_id,p_correlation_id,'SUCCESS','HIGH','SCAN_REQUIRED',jsonb_build_object('session_id',p_session_id));
  RETURN v_session.file_id;
END; $$;

CREATE OR REPLACE FUNCTION core.record_file_scan_result(
  p_file_id uuid,p_result_code varchar,p_scanner_reference varchar,p_correlation_id varchar DEFAULT NULL
) RETURNS varchar LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,governance AS $$
DECLARE v_file core.files%ROWTYPE; v_status varchar(30); v_session_status varchar(20);
BEGIN
  IF upper(p_result_code) NOT IN ('SAFE','QUARANTINED','REJECTED') OR nullif(btrim(p_scanner_reference),'') IS NULL OR length(p_scanner_reference)>500 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid scan result';
  END IF;
  SELECT * INTO v_file FROM core.files WHERE file_id=p_file_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='File not found'; END IF;
  IF v_file.scan_status_code<>'SCANNING' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='File is not awaiting scan result'; END IF;
  v_status:=upper(p_result_code); v_session_status:=CASE WHEN v_status='SAFE' THEN 'COMPLETED' ELSE 'CANCELLED' END;
  UPDATE core.files SET scan_status_code=v_status WHERE file_id=p_file_id;
  UPDATE core.file_upload_sessions SET status_code=v_session_status,completed_at=clock_timestamp() WHERE file_id=p_file_id;
  PERFORM governance.append_audit_event('FILES','MALWARE_SCAN_COMPLETED',v_file.uploaded_by_party_id,NULL,'MALWARE_SCANNER','file',p_file_id,p_correlation_id,CASE WHEN v_status='SAFE' THEN 'SUCCESS' ELSE 'DENIED' END,'HIGH',v_status,jsonb_build_object('scanner_reference',btrim(p_scanner_reference)));
  RETURN v_status;
END; $$;

CREATE OR REPLACE FUNCTION evidence.create_from_safe_file(
  p_file_id uuid,p_owner_party_id uuid,p_user_account_id uuid,p_evidence_type_code varchar,
  p_title_ar varchar,p_title_en varchar DEFAULT NULL,p_description_ar text DEFAULT NULL,
  p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,evidence,governance AS $$
DECLARE v_file core.files%ROWTYPE; v_evidence_id uuid:=gen_random_uuid();
BEGIN
  IF nullif(btrim(p_evidence_type_code),'') IS NULL OR length(p_evidence_type_code)>60 OR nullif(btrim(p_title_ar),'') IS NULL OR length(p_title_ar)>300 OR length(coalesce(p_title_en,''))>300 OR length(coalesce(p_description_ar,''))>4000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid evidence metadata';
  END IF;
  SELECT * INTO v_file FROM core.files WHERE file_id=p_file_id AND uploaded_by_party_id=p_owner_party_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Safe owned file not found'; END IF;
  IF v_file.scan_status_code<>'SAFE' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Only safe files can become evidence'; END IF;
  IF EXISTS(SELECT 1 FROM evidence.evidence_files WHERE file_id=p_file_id) THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='File is already linked as evidence'; END IF;
  INSERT INTO evidence.evidence_items(evidence_item_id,owner_party_id,evidence_type_code,title_ar,title_en,description_ar,status_code,confidentiality_level_code)
  VALUES(v_evidence_id,p_owner_party_id,upper(btrim(p_evidence_type_code)),btrim(p_title_ar),nullif(btrim(p_title_en),''),nullif(btrim(p_description_ar),''),'DRAFT',v_file.confidentiality_level_code);
  INSERT INTO evidence.evidence_files(evidence_item_id,file_id,file_role_code,display_order) VALUES(v_evidence_id,p_file_id,'PRIMARY_EVIDENCE',1);
  PERFORM governance.append_audit_event('EVIDENCE','EVIDENCE_CREATED_FROM_SAFE_FILE',p_owner_party_id,p_user_account_id,'MEMBER_SELF','evidence_item',v_evidence_id,p_correlation_id,'SUCCESS','NORMAL','SAFE_FILE',jsonb_build_object('file_id',p_file_id));
  RETURN v_evidence_id;
END; $$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0610_v113_backend_file_scan_evidence') ON CONFLICT DO NOTHING;
COMMIT;
