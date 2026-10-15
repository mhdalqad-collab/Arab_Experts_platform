BEGIN;

CREATE TABLE professional.publication_review_amendments(
  publication_review_amendment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_publication_request_id uuid NOT NULL REFERENCES professional.profile_publication_requests(profile_publication_request_id) ON DELETE RESTRICT,
  publication_review_finding_id uuid NOT NULL REFERENCES professional.publication_review_findings(publication_review_finding_id) ON DELETE RESTRICT,
  amendment_no integer NOT NULL CHECK(amendment_no>0),
  summary text NOT NULL CHECK(length(btrim(summary)) BETWEEN 1 AND 2000),
  base_target_snapshot jsonb NOT NULL,
  proposed_change_set jsonb NOT NULL CHECK(jsonb_typeof(proposed_change_set)='object' AND proposed_change_set<>'{}'::jsonb),
  comparison_snapshot jsonb NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'SUBMITTED' CHECK(status_code IN('SUBMITTED','ACCEPTED','REJECTED','WITHDRAWN')),
  submitted_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  decided_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewer_comment text,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  decided_at timestamptz,
  UNIQUE(profile_publication_request_id,amendment_no),
  CHECK((status_code IN('ACCEPTED','REJECTED') AND decided_by_party_id IS NOT NULL AND decided_at IS NOT NULL AND reviewer_comment IS NOT NULL) OR status_code NOT IN('ACCEPTED','REJECTED'))
);
CREATE UNIQUE INDEX uq_pending_publication_finding_amendment ON professional.publication_review_amendments(publication_review_finding_id) WHERE status_code='SUBMITTED';
CREATE INDEX idx_publication_review_amendments ON professional.publication_review_amendments(profile_publication_request_id,status_code,submitted_at);

CREATE OR REPLACE FUNCTION professional.submit_publication_review_amendment(
 p_request_id uuid,p_finding_id uuid,p_owner_party_id uuid,p_user_account_id uuid,p_summary text,p_change_set jsonb,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v_request professional.profile_publication_requests%ROWTYPE;v_finding professional.publication_review_findings%ROWTYPE;v_id uuid:=gen_random_uuid();v_no integer;v_response_no integer;v_base jsonb;
BEGIN
 SELECT * INTO v_request FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_request.requested_by_party_id<>p_owner_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Publication request owner required';END IF;
 IF v_request.status_code<>'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Review is not active';END IF;
 SELECT * INTO v_finding FROM professional.publication_review_findings WHERE publication_review_finding_id=p_finding_id AND profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Finding not found';END IF;
 IF v_finding.status_code NOT IN('OPEN','REOPENED') OR nullif(btrim(p_summary),'') IS NULL OR length(p_summary)>2000 OR jsonb_typeof(p_change_set)<>'object' OR p_change_set='{}'::jsonb OR pg_column_size(p_change_set)>32768 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Invalid or unavailable amendment';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_change_set) k WHERE k!~'^[a-zA-Z][a-zA-Z0-9_.-]{0,119}$') OR (SELECT count(*) FROM jsonb_object_keys(p_change_set))>30 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid amendment field set';END IF;
 v_base:=CASE v_finding.target_type_code
  WHEN 'PROFILE' THEN coalesce(v_request.submitted_snapshot_json->'profile','{}'::jsonb)
  WHEN 'READINESS' THEN coalesce(v_request.review_context_snapshot->'readiness','{}'::jsonb)
  WHEN 'FINGERPRINT' THEN coalesce((SELECT x FROM jsonb_array_elements(coalesce(v_request.submitted_snapshot_json->'fingerprints','[]'::jsonb)) x WHERE x->>'professional_fingerprint_id'=v_finding.target_entity_id::text LIMIT 1),'{}'::jsonb)
  WHEN 'EVIDENCE' THEN coalesce((SELECT x FROM jsonb_array_elements(coalesce(v_request.review_context_snapshot->'verifiedEvidenceSummaries','[]'::jsonb)) x WHERE x->>'evidenceItemId'=v_finding.target_entity_id::text LIMIT 1),'{}'::jsonb)
  ELSE '{}'::jsonb END;
 IF v_base='{}'::jsonb AND v_finding.target_type_code IN('FINGERPRINT','EVIDENCE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Frozen amendment target unavailable';END IF;
 SELECT coalesce(max(amendment_no),0)+1 INTO v_no FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id;
 INSERT INTO professional.publication_review_amendments(publication_review_amendment_id,profile_publication_request_id,publication_review_finding_id,amendment_no,summary,base_target_snapshot,proposed_change_set,comparison_snapshot,submitted_by_party_id)
 VALUES(v_id,p_request_id,p_finding_id,v_no,btrim(p_summary),v_base,p_change_set,jsonb_build_object('snapshotVersion','V113_REVIEW_AMENDMENT_1','before',v_base,'proposedChanges',p_change_set,'originalPublicationSnapshotPreserved',true),p_owner_party_id);
 SELECT coalesce(max(response_no),0)+1 INTO v_response_no FROM professional.publication_review_finding_responses WHERE publication_review_finding_id=p_finding_id;
 INSERT INTO professional.publication_review_finding_responses(publication_review_finding_id,response_no,response_text,responded_by_party_id) VALUES(p_finding_id,v_response_no,btrim(p_summary),p_owner_party_id);
 UPDATE professional.publication_review_findings SET status_code='RESPONDED',latest_member_response=btrim(p_summary),responded_at=clock_timestamp(),resolution_comment=NULL,resolved_at=NULL,resolved_by_party_id=NULL,updated_at=clock_timestamp() WHERE publication_review_finding_id=p_finding_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVIEW_AMENDMENT_SUBMITTED',p_owner_party_id,p_user_account_id,'MEMBER_SELF','publication_review_amendment',v_id,p_correlation_id,'SUCCESS','HIGH','SUBMITTED',jsonb_build_object('request_id',p_request_id,'finding_id',p_finding_id,'amendment_no',v_no,'changed_fields',(SELECT jsonb_agg(k) FROM jsonb_object_keys(p_change_set) k)));
 RETURN v_id;
END;$$;

CREATE OR REPLACE FUNCTION professional.decide_publication_review_amendment(
 p_request_id uuid,p_amendment_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_decision varchar,p_comment text,p_correlation_id varchar DEFAULT NULL
) RETURNS varchar LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v_request professional.profile_publication_requests%ROWTYPE;v_amendment professional.publication_review_amendments%ROWTYPE;v_status varchar;
BEGIN
 SELECT * INTO v_request FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_request.reviewer_party_id IS DISTINCT FROM p_reviewer_party_id OR v_request.requested_by_party_id=p_reviewer_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned reviewer required';END IF;
 IF v_request.status_code<>'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Review is not active';END IF;
 SELECT * INTO v_amendment FROM professional.publication_review_amendments WHERE publication_review_amendment_id=p_amendment_id AND profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Amendment not found';END IF;
 IF v_amendment.status_code<>'SUBMITTED' OR upper(p_decision) NOT IN('ACCEPT','REJECT') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Invalid amendment decision';END IF;
 v_status:=CASE WHEN upper(p_decision)='ACCEPT' THEN 'ACCEPTED' ELSE 'REJECTED' END;
 UPDATE professional.publication_review_amendments SET status_code=v_status,decided_by_party_id=p_reviewer_party_id,reviewer_comment=btrim(p_comment),decided_at=clock_timestamp() WHERE publication_review_amendment_id=p_amendment_id;
 IF v_status='REJECTED' THEN UPDATE professional.publication_review_findings SET status_code='REOPENED',resolution_comment=btrim(p_comment),resolved_at=NULL,resolved_by_party_id=NULL,updated_at=clock_timestamp() WHERE publication_review_finding_id=v_amendment.publication_review_finding_id;END IF;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVIEW_AMENDMENT_'||v_status,p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','publication_review_amendment',p_amendment_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('request_id',p_request_id,'finding_id',v_amendment.publication_review_finding_id,'comment',btrim(p_comment)));
 RETURN v_status;
END;$$;

CREATE OR REPLACE FUNCTION professional.resolve_publication_review_finding(
 p_request_id uuid,p_finding_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_action varchar,p_comment text,p_correlation_id varchar DEFAULT NULL
) RETURNS varchar LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v_request professional.profile_publication_requests%ROWTYPE;v_finding professional.publication_review_findings%ROWTYPE;v_action varchar:=upper(btrim(p_action));v_status varchar;
BEGIN
 SELECT * INTO v_request FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_request.reviewer_party_id IS DISTINCT FROM p_reviewer_party_id OR v_request.requested_by_party_id=p_reviewer_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned reviewer required';END IF;
 IF v_request.status_code<>'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Review is not active';END IF;
 SELECT * INTO v_finding FROM professional.publication_review_findings WHERE publication_review_finding_id=p_finding_id AND profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Finding not found';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_amendments WHERE publication_review_finding_id=p_finding_id AND status_code='SUBMITTED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Pending amendment must be decided first';END IF;
 IF v_action NOT IN('RESOLVE','REOPEN') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid resolution';END IF;
 IF (v_action='RESOLVE' AND v_finding.status_code NOT IN('OPEN','RESPONDED','REOPENED')) OR (v_action='REOPEN' AND v_finding.status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Invalid finding transition';END IF;
 v_status:=CASE WHEN v_action='RESOLVE' THEN 'RESOLVED' ELSE 'REOPENED' END;
 UPDATE professional.publication_review_findings SET status_code=v_status,resolution_comment=btrim(p_comment),resolved_at=CASE WHEN v_action='RESOLVE' THEN clock_timestamp() ELSE NULL END,resolved_by_party_id=CASE WHEN v_action='RESOLVE' THEN p_reviewer_party_id ELSE NULL END,updated_at=clock_timestamp() WHERE publication_review_finding_id=p_finding_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVIEW_FINDING_'||v_status,p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','publication_review_finding',p_finding_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('request_id',p_request_id,'comment',btrim(p_comment)));
 RETURN v_status;
END;$$;

CREATE OR REPLACE FUNCTION professional.recommend_profile_publication(p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_recommendation varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_status varchar;
BEGIN IF upper(p_recommendation) NOT IN('APPROVE','REJECT') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid recommendation required';END IF;
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id AND reviewer_party_id=p_reviewer_party_id AND status_code='UNDER_REVIEW' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Assigned review unavailable';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id AND status_code='SUBMITTED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Pending amendments must be decided before recommendation';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND severity_code IN('MAJOR','CRITICAL') AND status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Substantive review findings must be resolved before recommendation';END IF;
 v_status:=CASE WHEN upper(p_recommendation)='APPROVE' THEN 'RECOMMENDED' ELSE 'REJECT_RECOMMENDED' END;
 UPDATE professional.profile_publication_requests SET status_code=v_status,review_comment=btrim(p_comment),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_REVIEW_COMPLETED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('resolved_findings',(SELECT count(*) FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND status_code='RESOLVED'),'accepted_amendments',(SELECT count(*) FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id AND status_code='ACCEPTED')));RETURN p_request_id;END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0790_v113_backend_controlled_review_amendments') ON CONFLICT DO NOTHING;
COMMIT;
