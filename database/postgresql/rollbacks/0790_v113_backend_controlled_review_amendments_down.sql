BEGIN;
CREATE OR REPLACE FUNCTION professional.resolve_publication_review_finding(p_request_id uuid,p_finding_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_action varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS varchar LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v_request professional.profile_publication_requests%ROWTYPE;v_finding professional.publication_review_findings%ROWTYPE;v_action varchar:=upper(btrim(p_action));v_status varchar;
BEGIN SELECT * INTO v_request FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_request.reviewer_party_id IS DISTINCT FROM p_reviewer_party_id OR v_request.requested_by_party_id=p_reviewer_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned reviewer required';END IF;
 IF v_request.status_code<>'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Review is not active';END IF;
 SELECT * INTO v_finding FROM professional.publication_review_findings WHERE publication_review_finding_id=p_finding_id AND profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Finding not found';END IF;
 IF v_action NOT IN('RESOLVE','REOPEN') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid resolution';END IF;
 IF (v_action='RESOLVE' AND v_finding.status_code NOT IN('OPEN','RESPONDED','REOPENED')) OR (v_action='REOPEN' AND v_finding.status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Invalid finding transition';END IF;
 v_status:=CASE WHEN v_action='RESOLVE' THEN 'RESOLVED' ELSE 'REOPENED' END;
 UPDATE professional.publication_review_findings SET status_code=v_status,resolution_comment=btrim(p_comment),resolved_at=CASE WHEN v_action='RESOLVE' THEN clock_timestamp() ELSE NULL END,resolved_by_party_id=CASE WHEN v_action='RESOLVE' THEN p_reviewer_party_id ELSE NULL END,updated_at=clock_timestamp() WHERE publication_review_finding_id=p_finding_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVIEW_FINDING_'||v_status,p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','publication_review_finding',p_finding_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('request_id',p_request_id,'comment',btrim(p_comment)));RETURN v_status;END;$$;
CREATE OR REPLACE FUNCTION professional.recommend_profile_publication(p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_recommendation varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_status varchar;
BEGIN IF upper(p_recommendation) NOT IN('APPROVE','REJECT') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid recommendation required';END IF;
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id AND reviewer_party_id=p_reviewer_party_id AND status_code='UNDER_REVIEW' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Assigned review unavailable';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND severity_code IN('MAJOR','CRITICAL') AND status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Substantive review findings must be resolved before recommendation';END IF;
 v_status:=CASE WHEN upper(p_recommendation)='APPROVE' THEN 'RECOMMENDED' ELSE 'REJECT_RECOMMENDED' END;
 UPDATE professional.profile_publication_requests SET status_code=v_status,review_comment=btrim(p_comment),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_REVIEW_COMPLETED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('resolved_findings',(SELECT count(*) FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND status_code='RESOLVED')));RETURN p_request_id;END;$$;
DROP FUNCTION IF EXISTS professional.decide_publication_review_amendment(uuid,uuid,uuid,uuid,varchar,text,varchar);
DROP FUNCTION IF EXISTS professional.submit_publication_review_amendment(uuid,uuid,uuid,uuid,text,jsonb,varchar);
DROP TABLE IF EXISTS professional.publication_review_amendments;
DELETE FROM integration.schema_migrations WHERE migration_name='0790_v113_backend_controlled_review_amendments';
COMMIT;
