BEGIN;

INSERT INTO governance.permissions(permission_code,name_ar,name_en,domain_code,action_code,resource_type,risk_level_code,requires_step_up_auth,requires_reason)
VALUES
('professional.review','مراجعة الملفات المهنية','Review professional profiles','PROFESSIONAL','REVIEW','professional_profile','HIGH',true,true),
('professional.publish','اعتماد نشر الملفات المهنية','Approve professional profile publication','PROFESSIONAL','PUBLISH','professional_profile','CRITICAL',true,true)
ON CONFLICT(permission_code) DO UPDATE SET is_active=true,requires_step_up_auth=excluded.requires_step_up_auth,requires_reason=excluded.requires_reason;

INSERT INTO governance.role_permissions(role_id,permission_id,constraint_expression)
SELECT r.role_id,p.permission_id,'{"scope":"platform"}'::jsonb FROM governance.roles r JOIN governance.permissions p ON
(r.role_code='PLATFORM_OPERATOR' AND p.permission_code='professional.review') OR
(r.role_code='PLATFORM_ADMIN' AND p.permission_code='professional.publish')
ON CONFLICT(role_id,permission_id,valid_from) DO NOTHING;

CREATE TABLE professional.profile_publication_requests(
  profile_publication_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE RESTRICT,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  status_code varchar(30) NOT NULL DEFAULT 'SUBMITTED' CHECK(status_code IN('SUBMITTED','UNDER_REVIEW','RECOMMENDED','REJECT_RECOMMENDED','APPROVED','REJECTED','CANCELLED')),
  submitted_profile_row_version bigint NOT NULL CHECK(submitted_profile_row_version>0),
  submitted_snapshot_json jsonb NOT NULL,
  reviewer_party_id uuid REFERENCES core.parties(party_id),
  review_comment text,
  reviewed_at timestamptz,
  decided_by_party_id uuid REFERENCES core.parties(party_id),
  decision_comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX uq_open_profile_publication_request ON professional.profile_publication_requests(professional_profile_id) WHERE status_code IN('SUBMITTED','UNDER_REVIEW','RECOMMENDED','REJECT_RECOMMENDED');
CREATE INDEX idx_profile_publication_queue ON professional.profile_publication_requests(status_code,created_at);

CREATE OR REPLACE FUNCTION professional.submit_profile_publication(p_party_id uuid,p_user_account_id uuid,p_expected_row_version bigint,p_correlation_id varchar DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,core,professional,governance AS $$
DECLARE v professional.professional_profiles%ROWTYPE;v_id uuid:=gen_random_uuid();v_snapshot jsonb;
BEGIN
 SELECT * INTO v FROM professional.professional_profiles WHERE party_id=p_party_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Professional profile not found';END IF;
 IF v.row_version<>p_expected_row_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Profile version conflict';END IF;
 IF v.status_code NOT IN('DRAFT','PRIVATE','UPDATE_REQUIRED','HIDDEN') OR v.current_job_title_ar IS NULL OR v.total_professional_experience_years IS NULL OR NOT EXISTS(SELECT 1 FROM professional.professional_fingerprints WHERE professional_profile_id=v.professional_profile_id AND status_code IN('ACTIVE','UPDATE_REQUIRED')) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Profile is not publication ready';END IF;
 SELECT jsonb_build_object('profile',to_jsonb(v),'fingerprints',coalesce(jsonb_agg(to_jsonb(pf) ORDER BY pf.fingerprint_code),'[]'::jsonb)) INTO v_snapshot FROM professional.professional_fingerprints pf WHERE pf.professional_profile_id=v.professional_profile_id AND pf.status_code IN('ACTIVE','UPDATE_REQUIRED');
 INSERT INTO professional.profile_publication_requests(profile_publication_request_id,professional_profile_id,requested_by_party_id,submitted_profile_row_version,submitted_snapshot_json) VALUES(v_id,v.professional_profile_id,p_party_id,v.row_version,v_snapshot);
 PERFORM set_config('eim.transition_context','allowed',true);UPDATE professional.professional_profiles SET status_code='PENDING_REVIEW' WHERE professional_profile_id=v.professional_profile_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_PUBLICATION_SUBMITTED',p_party_id,p_user_account_id,'MEMBER_SELF','professional_profile',v.professional_profile_id,p_correlation_id,'SUCCESS','HIGH','SUBMITTED',jsonb_build_object('request_id',v_id));RETURN v_id;
END;$$;

CREATE OR REPLACE FUNCTION professional.claim_profile_publication_review(p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_correlation_id varchar DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;
BEGIN SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v.status_code<>'SUBMITTED' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Publication request unavailable';END IF;
 IF v.requested_by_party_id=p_reviewer_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Self review forbidden';END IF;
 UPDATE professional.profile_publication_requests SET status_code='UNDER_REVIEW',reviewer_party_id=p_reviewer_party_id,updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_REVIEW_CLAIMED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','HIGH','UNDER_REVIEW','{}');RETURN p_request_id;END;$$;

CREATE OR REPLACE FUNCTION professional.recommend_profile_publication(p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_recommendation varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_status varchar;
BEGIN IF upper(p_recommendation) NOT IN('APPROVE','REJECT') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid recommendation required';END IF;
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id AND reviewer_party_id=p_reviewer_party_id AND status_code='UNDER_REVIEW' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Assigned review unavailable';END IF;v_status:=CASE WHEN upper(p_recommendation)='APPROVE' THEN 'RECOMMENDED' ELSE 'REJECT_RECOMMENDED' END;
 UPDATE professional.profile_publication_requests SET status_code=v_status,review_comment=btrim(p_comment),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_REVIEW_COMPLETED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',v_status,'{}');RETURN p_request_id;END;$$;

CREATE OR REPLACE FUNCTION professional.decide_profile_publication(p_request_id uuid,p_decider_party_id uuid,p_user_account_id uuid,p_decision varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS varchar
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_status varchar;v_profile_status varchar;
BEGIN IF upper(p_decision) NOT IN('APPROVED','REJECTED') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid decision required';END IF;
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v.status_code NOT IN('RECOMMENDED','REJECT_RECOMMENDED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Completed review required';END IF;
 IF v.requested_by_party_id=p_decider_party_id OR v.reviewer_party_id=p_decider_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Separation of duties violation';END IF;
 IF (upper(p_decision)='APPROVED' AND v.status_code<>'RECOMMENDED') OR (upper(p_decision)='REJECTED' AND v.status_code<>'REJECT_RECOMMENDED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Decision must match recommendation';END IF;
 v_status:=upper(p_decision);v_profile_status:=CASE WHEN v_status='APPROVED' THEN 'PUBLISHED' ELSE 'UPDATE_REQUIRED' END;
 UPDATE professional.profile_publication_requests SET status_code=v_status,decided_by_party_id=p_decider_party_id,decision_comment=btrim(p_comment),decided_at=clock_timestamp(),updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM set_config('eim.transition_context','allowed',true);UPDATE professional.professional_profiles SET status_code=v_profile_status WHERE professional_profile_id=v.professional_profile_id;
 IF v_status='APPROVED' THEN UPDATE professional.professional_fingerprints SET status_code='ACTIVE' WHERE professional_profile_id=v.professional_profile_id AND status_code='UPDATE_REQUIRED';END IF;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_PUBLICATION_DECIDED',p_decider_party_id,p_user_account_id,'PLATFORM_ADMIN','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','CRITICAL',v_status,jsonb_build_object('profile_status',v_profile_status));RETURN v_status;END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0670_v113_backend_professional_publication') ON CONFLICT DO NOTHING;
COMMIT;
