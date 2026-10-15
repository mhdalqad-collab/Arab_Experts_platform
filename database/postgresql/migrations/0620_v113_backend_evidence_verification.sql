BEGIN;

CREATE OR REPLACE FUNCTION evidence.submit_verification_request(
  p_evidence_item_id uuid,p_owner_party_id uuid,p_user_account_id uuid,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,evidence,governance AS $$
DECLARE v_item evidence.evidence_items%ROWTYPE; v_request_id uuid:=gen_random_uuid();
BEGIN
  SELECT * INTO v_item FROM evidence.evidence_items WHERE evidence_item_id=p_evidence_item_id AND owner_party_id=p_owner_party_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Evidence not found'; END IF;
  IF v_item.status_code<>'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Evidence is not a draft'; END IF;
  IF NOT EXISTS(SELECT 1 FROM evidence.evidence_files ef JOIN core.files f ON f.file_id=ef.file_id WHERE ef.evidence_item_id=p_evidence_item_id AND f.scan_status_code='SAFE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Safe evidence file is required';
  END IF;
  INSERT INTO evidence.verification_requests(verification_request_id,evidence_item_id,request_type_code,requested_by_party_id,status_code,priority_code,due_at)
  VALUES(v_request_id,p_evidence_item_id,'PROFESSIONAL_EVIDENCE',p_owner_party_id,'SUBMITTED','NORMAL',clock_timestamp()+interval '10 days');
  PERFORM set_config('eim.transition_context','allowed',true);
  UPDATE evidence.evidence_items SET status_code='SUBMITTED' WHERE evidence_item_id=p_evidence_item_id;
  PERFORM governance.append_audit_event('EVIDENCE','VERIFICATION_REQUESTED',p_owner_party_id,p_user_account_id,'MEMBER_SELF','evidence_item',p_evidence_item_id,p_correlation_id,'SUCCESS','NORMAL','SELF_SUBMITTED',jsonb_build_object('verification_request_id',v_request_id));
  RETURN v_request_id;
END; $$;

CREATE OR REPLACE FUNCTION evidence.claim_verification_request(
  p_request_id uuid,p_verifier_party_id uuid,p_verifier_user_account_id uuid,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,evidence,governance AS $$
DECLARE v_request evidence.verification_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM evidence.verification_requests WHERE verification_request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Verification request not found'; END IF;
  IF v_request.status_code<>'SUBMITTED' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Request is not available'; END IF;
  IF v_request.requested_by_party_id=p_verifier_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Self verification is forbidden'; END IF;
  PERFORM set_config('eim.transition_context','allowed',true);
  UPDATE evidence.verification_requests SET status_code='IN_PROGRESS',assigned_to_party_id=p_verifier_party_id WHERE verification_request_id=p_request_id;
  UPDATE evidence.evidence_items SET status_code='SCREENING' WHERE evidence_item_id=v_request.evidence_item_id;
  PERFORM governance.append_audit_event('EVIDENCE','VERIFICATION_CLAIMED',p_verifier_party_id,p_verifier_user_account_id,'VERIFIER','verification_request',p_request_id,p_correlation_id,'SUCCESS','HIGH','CLAIMED',jsonb_build_object('evidence_item_id',v_request.evidence_item_id));
  RETURN p_request_id;
END; $$;

CREATE OR REPLACE FUNCTION evidence.add_verification_check(
  p_request_id uuid,p_verifier_party_id uuid,p_verifier_user_account_id uuid,
  p_check_type_code varchar,p_result_code varchar,p_response_reference text,p_notes text,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,evidence,governance AS $$
DECLARE v_request evidence.verification_requests%ROWTYPE; v_check_id uuid:=gen_random_uuid();
BEGIN
  IF nullif(btrim(p_check_type_code),'') IS NULL OR length(p_check_type_code)>50 OR upper(p_result_code) NOT IN('PASS','PARTIAL','FAIL','INCONCLUSIVE') OR length(coalesce(p_response_reference,''))>1000 OR nullif(btrim(p_notes),'') IS NULL OR length(p_notes)>4000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid verification check';
  END IF;
  SELECT * INTO v_request FROM evidence.verification_requests WHERE verification_request_id=p_request_id AND assigned_to_party_id=p_verifier_party_id AND status_code='IN_PROGRESS' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Assigned verification request not found'; END IF;
  INSERT INTO evidence.verification_checks(verification_check_id,verification_request_id,check_type_code,check_result_code,response_reference,notes,checked_by_party_id)
  VALUES(v_check_id,p_request_id,upper(btrim(p_check_type_code)),upper(p_result_code),nullif(btrim(p_response_reference),''),btrim(p_notes),p_verifier_party_id);
  PERFORM governance.append_audit_event('EVIDENCE','VERIFICATION_CHECK_RECORDED',p_verifier_party_id,p_verifier_user_account_id,'VERIFIER','verification_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',upper(p_result_code),jsonb_build_object('check_id',v_check_id,'check_type_code',upper(btrim(p_check_type_code))));
  RETURN v_check_id;
END; $$;

CREATE OR REPLACE FUNCTION evidence.decide_verification_request(
  p_request_id uuid,p_verifier_party_id uuid,p_verifier_user_account_id uuid,
  p_decision_code varchar,p_rationale text,p_valid_until date DEFAULT NULL,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,evidence,governance AS $$
DECLARE v_request evidence.verification_requests%ROWTYPE; v_decision_id uuid:=gen_random_uuid(); v_item_status varchar(30);
BEGIN
  IF upper(p_decision_code) NOT IN('VERIFIED','PARTIALLY_VERIFIED','UNVERIFIED','REJECTED') OR nullif(btrim(p_rationale),'') IS NULL OR length(p_rationale)>4000 OR (p_valid_until IS NOT NULL AND p_valid_until<current_date) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid verification decision';
  END IF;
  SELECT * INTO v_request FROM evidence.verification_requests WHERE verification_request_id=p_request_id AND assigned_to_party_id=p_verifier_party_id AND status_code='IN_PROGRESS' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Assigned verification request not found'; END IF;
  IF v_request.requested_by_party_id=p_verifier_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Self verification is forbidden'; END IF;
  IF NOT EXISTS(SELECT 1 FROM evidence.verification_checks WHERE verification_request_id=p_request_id AND checked_by_party_id=p_verifier_party_id) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='At least one verification check is required'; END IF;
  v_item_status:=CASE upper(p_decision_code) WHEN 'UNVERIFIED' THEN 'REJECTED' ELSE upper(p_decision_code) END;
  INSERT INTO evidence.verification_decisions(verification_decision_id,verification_request_id,decision_code,valid_until,rationale,decided_by_party_id)
  VALUES(v_decision_id,p_request_id,upper(p_decision_code),p_valid_until,btrim(p_rationale),p_verifier_party_id);
  PERFORM set_config('eim.transition_context','allowed',true);
  UPDATE evidence.verification_requests SET status_code='DECIDED' WHERE verification_request_id=p_request_id;
  UPDATE evidence.evidence_items SET status_code=v_item_status WHERE evidence_item_id=v_request.evidence_item_id;
  PERFORM governance.append_audit_event('EVIDENCE','VERIFICATION_DECIDED',p_verifier_party_id,p_verifier_user_account_id,'VERIFIER','verification_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',upper(p_decision_code),jsonb_build_object('decision_id',v_decision_id,'evidence_item_id',v_request.evidence_item_id,'valid_until',p_valid_until));
  RETURN v_decision_id;
END; $$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0620_v113_backend_evidence_verification') ON CONFLICT DO NOTHING;
COMMIT;
