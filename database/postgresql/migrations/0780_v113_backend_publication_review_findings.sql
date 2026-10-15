BEGIN;

CREATE TABLE professional.publication_review_findings(
  publication_review_finding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_publication_request_id uuid NOT NULL REFERENCES professional.profile_publication_requests(profile_publication_request_id) ON DELETE RESTRICT,
  finding_no integer NOT NULL CHECK(finding_no>0),
  target_type_code varchar(30) NOT NULL CHECK(target_type_code IN('PROFILE','FINGERPRINT','EVIDENCE','READINESS')),
  target_entity_id uuid,
  category_code varchar(100) NOT NULL CHECK(category_code~'^[A-Z][A-Z0-9_-]{0,99}$'),
  severity_code varchar(20) NOT NULL CHECK(severity_code IN('INFO','MINOR','MAJOR','CRITICAL')),
  description text NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 3000),
  required_action text NOT NULL CHECK(length(btrim(required_action)) BETWEEN 1 AND 2000),
  status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(status_code IN('OPEN','RESPONDED','RESOLVED','REOPENED')),
  latest_member_response text,
  responded_at timestamptz,
  resolution_comment text,
  resolved_at timestamptz,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  resolved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(profile_publication_request_id,finding_no),
  CHECK((target_type_code IN('PROFILE','READINESS') AND target_entity_id IS NULL) OR (target_type_code IN('FINGERPRINT','EVIDENCE') AND target_entity_id IS NOT NULL)),
  CHECK((status_code='RESOLVED' AND resolved_at IS NOT NULL AND resolved_by_party_id IS NOT NULL) OR status_code<>'RESOLVED')
);
CREATE INDEX idx_publication_review_findings_open ON professional.publication_review_findings(profile_publication_request_id,severity_code,status_code) WHERE status_code<>'RESOLVED';

CREATE TABLE professional.publication_review_finding_responses(
  publication_review_finding_response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_review_finding_id uuid NOT NULL REFERENCES professional.publication_review_findings(publication_review_finding_id) ON DELETE RESTRICT,
  response_no integer NOT NULL CHECK(response_no>0),
  response_text text NOT NULL CHECK(length(btrim(response_text)) BETWEEN 1 AND 3000),
  responded_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(publication_review_finding_id,response_no)
);

CREATE OR REPLACE FUNCTION professional.add_publication_review_finding(
 p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_target_type varchar,p_target_id uuid,
 p_category varchar,p_severity varchar,p_description text,p_required_action text,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_id uuid:=gen_random_uuid();v_no integer;v_type varchar:=upper(btrim(p_target_type));v_severity varchar:=upper(btrim(p_severity));v_category varchar:=upper(btrim(p_category));
BEGIN
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Publication request not found';END IF;
 IF v.status_code<>'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Review is not active';END IF;
 IF v.reviewer_party_id IS DISTINCT FROM p_reviewer_party_id OR v.requested_by_party_id=p_reviewer_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned reviewer required';END IF;
 IF v_type NOT IN('PROFILE','FINGERPRINT','EVIDENCE','READINESS') OR v_severity NOT IN('INFO','MINOR','MAJOR','CRITICAL') OR v_category!~'^[A-Z][A-Z0-9_-]{0,99}$' OR nullif(btrim(p_description),'') IS NULL OR length(p_description)>3000 OR nullif(btrim(p_required_action),'') IS NULL OR length(p_required_action)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid review finding';END IF;
 IF (v_type IN('PROFILE','READINESS') AND p_target_id IS NOT NULL) OR (v_type IN('FINGERPRINT','EVIDENCE') AND p_target_id IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid finding target';END IF;
 IF v_type='EVIDENCE' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v.review_context_snapshot->'verifiedEvidenceSummaries','[]'::jsonb)) x WHERE x->>'evidenceItemId'=p_target_id::text) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Evidence target is outside frozen context';END IF;
 IF v_type='FINGERPRINT' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v.review_context_snapshot->'fingerprintStrengths','[]'::jsonb)) x WHERE x->>'professionalFingerprintId'=p_target_id::text) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Fingerprint target is outside frozen context';END IF;
 SELECT coalesce(max(finding_no),0)+1 INTO v_no FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id;
 INSERT INTO professional.publication_review_findings(publication_review_finding_id,profile_publication_request_id,finding_no,target_type_code,target_entity_id,category_code,severity_code,description,required_action,created_by_party_id)
 VALUES(v_id,p_request_id,v_no,v_type,p_target_id,v_category,v_severity,btrim(p_description),btrim(p_required_action),p_reviewer_party_id);
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVIEW_FINDING_CREATED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','publication_review_finding',v_id,p_correlation_id,'SUCCESS','HIGH',v_severity,jsonb_build_object('request_id',p_request_id,'finding_no',v_no,'target_type',v_type,'target_id',p_target_id,'category',v_category));
 RETURN v_id;
END;$$;

CREATE OR REPLACE FUNCTION professional.respond_publication_review_finding(
 p_request_id uuid,p_finding_id uuid,p_owner_party_id uuid,p_user_account_id uuid,p_response text,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v_request professional.profile_publication_requests%ROWTYPE;v_finding professional.publication_review_findings%ROWTYPE;v_no integer;
BEGIN
 SELECT * INTO v_request FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_request.requested_by_party_id<>p_owner_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Publication request owner required';END IF;
 IF v_request.status_code<>'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Review is not active';END IF;
 SELECT * INTO v_finding FROM professional.publication_review_findings WHERE publication_review_finding_id=p_finding_id AND profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Finding not found';END IF;
 IF v_finding.status_code NOT IN('OPEN','REOPENED') OR nullif(btrim(p_response),'') IS NULL OR length(p_response)>3000 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Finding cannot accept a response';END IF;
 SELECT coalesce(max(response_no),0)+1 INTO v_no FROM professional.publication_review_finding_responses WHERE publication_review_finding_id=p_finding_id;
 INSERT INTO professional.publication_review_finding_responses(publication_review_finding_id,response_no,response_text,responded_by_party_id) VALUES(p_finding_id,v_no,btrim(p_response),p_owner_party_id);
 UPDATE professional.publication_review_findings SET status_code='RESPONDED',latest_member_response=btrim(p_response),responded_at=clock_timestamp(),resolution_comment=NULL,resolved_at=NULL,resolved_by_party_id=NULL,updated_at=clock_timestamp() WHERE publication_review_finding_id=p_finding_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVIEW_FINDING_RESPONDED',p_owner_party_id,p_user_account_id,'MEMBER_SELF','publication_review_finding',p_finding_id,p_correlation_id,'SUCCESS','HIGH','RESPONDED',jsonb_build_object('request_id',p_request_id,'response_no',v_no));
 RETURN p_finding_id;
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
 IF EXISTS(SELECT 1 FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND severity_code IN('MAJOR','CRITICAL') AND status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Substantive review findings must be resolved before recommendation';END IF;
 v_status:=CASE WHEN upper(p_recommendation)='APPROVE' THEN 'RECOMMENDED' ELSE 'REJECT_RECOMMENDED' END;
 UPDATE professional.profile_publication_requests SET status_code=v_status,review_comment=btrim(p_comment),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_REVIEW_COMPLETED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('resolved_findings',(SELECT count(*) FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND status_code='RESOLVED')));RETURN p_request_id;END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0780_v113_backend_publication_review_findings') ON CONFLICT DO NOTHING;
COMMIT;
