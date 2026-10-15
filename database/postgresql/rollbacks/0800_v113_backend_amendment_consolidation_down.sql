BEGIN;
CREATE OR REPLACE FUNCTION professional.recommend_profile_publication(p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_recommendation varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_status varchar;
BEGIN IF upper(p_recommendation) NOT IN('APPROVE','REJECT') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid recommendation required';END IF;
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id AND reviewer_party_id=p_reviewer_party_id AND status_code='UNDER_REVIEW' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Assigned review unavailable';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id AND status_code='SUBMITTED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Pending amendments must be decided before recommendation';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND severity_code IN('MAJOR','CRITICAL') AND status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Substantive review findings must be resolved before recommendation';END IF;
 v_status:=CASE WHEN upper(p_recommendation)='APPROVE' THEN 'RECOMMENDED' ELSE 'REJECT_RECOMMENDED' END;
 UPDATE professional.profile_publication_requests SET status_code=v_status,review_comment=btrim(p_comment),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_REVIEW_COMPLETED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('resolved_findings',(SELECT count(*) FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND status_code='RESOLVED'),'accepted_amendments',(SELECT count(*) FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id AND status_code='ACCEPTED')));RETURN p_request_id;END;$$;
DROP FUNCTION IF EXISTS professional.consolidate_publication_review(uuid,uuid,uuid,varchar);
DROP FUNCTION IF EXISTS professional.publication_review_source_state_hash(uuid);
ALTER TABLE professional.profile_publication_requests DROP COLUMN IF EXISTS consolidated_snapshot_id;
DROP TABLE IF EXISTS professional.publication_review_consolidated_snapshots;
DELETE FROM integration.schema_migrations WHERE migration_name='0800_v113_backend_amendment_consolidation';
COMMIT;
