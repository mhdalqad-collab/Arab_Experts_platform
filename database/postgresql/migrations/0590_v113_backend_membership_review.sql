BEGIN;

INSERT INTO governance.permissions (
  permission_code, name_ar, name_en, domain_code, action_code, resource_type,
  risk_level_code, requires_step_up_auth, requires_reason
) VALUES
  ('membership.review', 'مراجعة طلبات العضوية', 'Review membership applications', 'MEMBERSHIP', 'REVIEW', 'membership_application', 'HIGH', true, true),
  ('membership.approve', 'اعتماد قرارات العضوية', 'Approve membership decisions', 'MEMBERSHIP', 'APPROVE', 'membership_application', 'CRITICAL', true, true)
ON CONFLICT (permission_code) DO UPDATE SET
  name_ar = excluded.name_ar, name_en = excluded.name_en,
  requires_step_up_auth = excluded.requires_step_up_auth, requires_reason = excluded.requires_reason,
  is_active = true;

INSERT INTO governance.role_permissions (role_id, permission_id, constraint_expression)
SELECT r.role_id, p.permission_id, '{"scope":"platform"}'::jsonb
FROM governance.roles r JOIN governance.permissions p ON
  (r.role_code = 'PLATFORM_OPERATOR' AND p.permission_code = 'membership.review') OR
  (r.role_code = 'PLATFORM_ADMIN' AND p.permission_code = 'membership.approve')
ON CONFLICT (role_id, permission_id, valid_from) DO NOTHING;

INSERT INTO governance.segregation_of_duties_rules (
  rule_code, name_ar, first_permission_id, second_permission_id, enforcement_code, rationale
)
SELECT 'SOD_MEMBERSHIP_REVIEW_APPROVE', 'فصل مراجعة العضوية عن اعتمادها',
       p1.permission_id, p2.permission_id, 'BLOCK',
       'لا يجوز للمراجع نفسه إصدار قرار الاعتماد النهائي.'
FROM governance.permissions p1, governance.permissions p2
WHERE p1.permission_code = 'membership.review' AND p2.permission_code = 'membership.approve'
ON CONFLICT (rule_code) DO NOTHING;

CREATE OR REPLACE FUNCTION membership.claim_application_review(
  p_application_id uuid, p_reviewer_party_id uuid, p_reviewer_user_account_id uuid,
  p_correlation_id varchar DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, membership, governance
AS $$
DECLARE v_application membership.membership_applications%ROWTYPE; v_review_id uuid;
BEGIN
  SELECT * INTO v_application FROM membership.membership_applications
  WHERE membership_application_id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Application not found'; END IF;
  IF v_application.party_id = p_reviewer_party_id THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Self review is forbidden'; END IF;
  IF v_application.status_code <> 'SUBMITTED' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Application is not available for review'; END IF;
  IF EXISTS (SELECT 1 FROM membership.membership_reviews WHERE membership_application_id=p_application_id AND status_code IN ('ASSIGNED','IN_PROGRESS')) THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Application already has an active review';
  END IF;
  INSERT INTO membership.membership_reviews (membership_application_id, review_type_code, reviewer_party_id, status_code)
  VALUES (p_application_id, 'MEMBERSHIP_ELIGIBILITY', p_reviewer_party_id, 'IN_PROGRESS') RETURNING membership_review_id INTO v_review_id;
  PERFORM set_config('eim.transition_context','allowed',true);
  UPDATE membership.membership_applications SET status_code='UNDER_REVIEW', updated_by_party_id=p_reviewer_party_id WHERE membership_application_id=p_application_id;
  INSERT INTO membership.membership_application_status_history (membership_application_id,from_status_code,to_status_code,reason_code,changed_by_party_id,request_id)
  VALUES (p_application_id,'SUBMITTED','UNDER_REVIEW','REVIEW_CLAIMED',p_reviewer_party_id,p_correlation_id);
  PERFORM governance.append_audit_event('MEMBERSHIP','REVIEW_CLAIMED',p_reviewer_party_id,p_reviewer_user_account_id,'PLATFORM_OPERATOR','membership_application',p_application_id,p_correlation_id,'SUCCESS','HIGH','REVIEW_CLAIMED',jsonb_build_object('review_id',v_review_id));
  RETURN v_review_id;
END; $$;

CREATE OR REPLACE FUNCTION membership.complete_application_review(
  p_application_id uuid, p_reviewer_party_id uuid, p_reviewer_user_account_id uuid,
  p_recommendation_code varchar, p_comments text, p_correlation_id varchar DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, membership, governance
AS $$
DECLARE v_review membership.membership_reviews%ROWTYPE; v_target varchar(30);
BEGIN
  IF upper(p_recommendation_code) NOT IN ('APPROVE','REJECT','MORE_INFO_REQUIRED') OR nullif(btrim(p_comments),'') IS NULL OR length(p_comments)>2000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Valid recommendation and comments are required';
  END IF;
  SELECT r.* INTO v_review FROM membership.membership_reviews r
  JOIN membership.membership_applications a ON a.membership_application_id=r.membership_application_id
  WHERE r.membership_application_id=p_application_id AND r.reviewer_party_id=p_reviewer_party_id
    AND r.status_code='IN_PROGRESS' AND a.status_code='UNDER_REVIEW' FOR UPDATE OF r;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Active assigned review not found'; END IF;
  v_target := CASE WHEN upper(p_recommendation_code)='MORE_INFO_REQUIRED' THEN 'MORE_INFO_REQUIRED' ELSE 'UNDER_REVIEW' END;
  UPDATE membership.membership_reviews SET status_code='COMPLETED',recommendation_code=upper(p_recommendation_code),comments=btrim(p_comments),completed_at=clock_timestamp() WHERE membership_review_id=v_review.membership_review_id;
  IF v_target='MORE_INFO_REQUIRED' THEN
    PERFORM set_config('eim.transition_context','allowed',true);
    UPDATE membership.membership_applications SET status_code=v_target,updated_by_party_id=p_reviewer_party_id WHERE membership_application_id=p_application_id;
    INSERT INTO membership.membership_application_status_history (membership_application_id,from_status_code,to_status_code,reason_code,comment,changed_by_party_id,request_id)
    VALUES (p_application_id,'UNDER_REVIEW',v_target,'REVIEW_MORE_INFO',btrim(p_comments),p_reviewer_party_id,p_correlation_id);
  END IF;
  PERFORM governance.append_audit_event('MEMBERSHIP','REVIEW_COMPLETED',p_reviewer_party_id,p_reviewer_user_account_id,'PLATFORM_OPERATOR','membership_application',p_application_id,p_correlation_id,'SUCCESS','HIGH',upper(p_recommendation_code),jsonb_build_object('review_id',v_review.membership_review_id));
  RETURN v_review.membership_review_id;
END; $$;

CREATE OR REPLACE FUNCTION membership.decide_application(
  p_application_id uuid, p_decider_party_id uuid, p_decider_user_account_id uuid,
  p_decision_code varchar, p_reason_code varchar, p_comment text, p_correlation_id varchar DEFAULT NULL
) RETURNS TABLE(status_code varchar, membership_id uuid)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, membership, governance
AS $$
DECLARE v_application membership.membership_applications%ROWTYPE; v_review membership.membership_reviews%ROWTYPE;
  v_status varchar(30); v_membership_id uuid;
BEGIN
  IF upper(p_decision_code) NOT IN ('APPROVED','REJECTED') OR nullif(btrim(p_reason_code),'') IS NULL OR length(p_reason_code)>50 OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Decision, reason and comment are required';
  END IF;
  SELECT * INTO v_application FROM membership.membership_applications WHERE membership_application_id=p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Application not found'; END IF;
  SELECT r.* INTO v_review FROM membership.membership_reviews r WHERE r.membership_application_id=p_application_id AND r.status_code='COMPLETED' AND r.recommendation_code IN ('APPROVE','REJECT') ORDER BY r.completed_at DESC LIMIT 1;
  IF NOT FOUND OR v_application.status_code <> 'UNDER_REVIEW' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Completed review is required'; END IF;
  IF v_application.party_id=p_decider_party_id OR v_review.reviewer_party_id=p_decider_party_id THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Separation of duties violation'; END IF;
  IF (upper(p_decision_code)='APPROVED' AND v_review.recommendation_code<>'APPROVE') OR (upper(p_decision_code)='REJECTED' AND v_review.recommendation_code<>'REJECT') THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Decision must match completed recommendation';
  END IF;
  v_status := upper(p_decision_code);
  PERFORM set_config('eim.transition_context','allowed',true);
  UPDATE membership.membership_applications SET status_code=v_status,decided_at=clock_timestamp(),decision_reason_code=upper(btrim(p_reason_code)),updated_by_party_id=p_decider_party_id WHERE membership_application_id=p_application_id;
  IF v_status='APPROVED' THEN
    v_membership_id := gen_random_uuid();
    INSERT INTO membership.memberships (membership_id,party_id,membership_type_id,source_application_id,membership_number,status_code,activated_at,valid_from,created_by_party_id,updated_by_party_id)
    VALUES (v_membership_id,v_application.party_id,v_application.membership_type_id,p_application_id,'M-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(v_membership_id::text,'-',''),1,12)),'ACTIVE',clock_timestamp(),current_date,p_decider_party_id,p_decider_party_id);
    INSERT INTO membership.membership_status_history (membership_id,to_status_code,reason_code,comment,changed_by_party_id,request_id)
    VALUES (v_membership_id,'ACTIVE','APPLICATION_APPROVED',btrim(p_comment),p_decider_party_id,p_correlation_id);
  END IF;
  INSERT INTO membership.membership_application_status_history (membership_application_id,from_status_code,to_status_code,reason_code,comment,changed_by_party_id,request_id)
  VALUES (p_application_id,'UNDER_REVIEW',v_status,upper(btrim(p_reason_code)),btrim(p_comment),p_decider_party_id,p_correlation_id);
  PERFORM governance.append_audit_event('MEMBERSHIP','APPLICATION_DECIDED',p_decider_party_id,p_decider_user_account_id,'PLATFORM_ADMIN','membership_application',p_application_id,p_correlation_id,'SUCCESS','CRITICAL',upper(btrim(p_reason_code)),jsonb_build_object('decision',v_status,'review_id',v_review.membership_review_id,'membership_id',v_membership_id));
  RETURN QUERY SELECT v_status, v_membership_id;
END; $$;

INSERT INTO integration.schema_migrations (migration_name) VALUES ('0590_v113_backend_membership_review') ON CONFLICT DO NOTHING;
COMMIT;
