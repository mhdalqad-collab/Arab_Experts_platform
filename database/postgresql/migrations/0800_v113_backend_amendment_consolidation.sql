BEGIN;

CREATE TABLE professional.publication_review_consolidated_snapshots(
  publication_review_consolidated_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_publication_request_id uuid NOT NULL REFERENCES professional.profile_publication_requests(profile_publication_request_id) ON DELETE RESTRICT,
  snapshot_version_no integer NOT NULL CHECK(snapshot_version_no>0),
  consolidated_snapshot jsonb NOT NULL,
  source_state_hash_sha256 char(64) NOT NULL,
  integrity_hash_sha256 char(64) NOT NULL,
  accepted_amendment_count integer NOT NULL CHECK(accepted_amendment_count>=0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(profile_publication_request_id,snapshot_version_no),
  UNIQUE(profile_publication_request_id,integrity_hash_sha256)
);

ALTER TABLE professional.profile_publication_requests
ADD COLUMN IF NOT EXISTS consolidated_snapshot_id uuid REFERENCES professional.publication_review_consolidated_snapshots(publication_review_consolidated_snapshot_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION professional.publication_review_source_state_hash(p_request_id uuid) RETURNS char(64)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,professional AS $$
 SELECT encode(digest(convert_to(jsonb_build_object(
   'requestId',r.profile_publication_request_id,
   'submittedProfileRowVersion',r.submitted_profile_row_version,
   'findings',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.publication_review_finding_id,'status',f.status_code,'severity',f.severity_code,'updatedAt',f.updated_at) ORDER BY f.finding_no) FROM professional.publication_review_findings f WHERE f.profile_publication_request_id=r.profile_publication_request_id),'[]'::jsonb),
   'amendments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.publication_review_amendment_id,'status',a.status_code,'decidedAt',a.decided_at) ORDER BY a.amendment_no) FROM professional.publication_review_amendments a WHERE a.profile_publication_request_id=r.profile_publication_request_id),'[]'::jsonb)
 )::text,'UTF8'),'sha256'),'hex')::char(64)
 FROM professional.profile_publication_requests r WHERE r.profile_publication_request_id=p_request_id;
$$;

CREATE OR REPLACE FUNCTION professional.consolidate_publication_review(p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_correlation_id varchar DEFAULT NULL)
RETURNS TABLE(snapshot_id uuid,integrity_hash char(64)) LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_id uuid:=gen_random_uuid();v_version integer;v_count integer;v_snapshot jsonb;v_source_hash char(64);v_integrity char(64);
BEGIN
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Publication request not found';END IF;
 IF v.status_code<>'UNDER_REVIEW' OR v.reviewer_party_id IS DISTINCT FROM p_reviewer_party_id OR v.requested_by_party_id=p_reviewer_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned active reviewer required';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id AND status_code='SUBMITTED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Pending amendments prevent consolidation';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND severity_code IN('MAJOR','CRITICAL') AND status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Substantive findings prevent consolidation';END IF;
 SELECT count(*)::integer INTO v_count FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id AND status_code='ACCEPTED';
 SELECT coalesce(max(snapshot_version_no),0)+1 INTO v_version FROM professional.publication_review_consolidated_snapshots WHERE profile_publication_request_id=p_request_id;
 v_source_hash:=professional.publication_review_source_state_hash(p_request_id);
 v_snapshot:=jsonb_build_object(
   'snapshotVersion','V113_CONSOLIDATED_PUBLICATION_1',
   'sourcePublicationRequestId',p_request_id,
   'originalSubmission',v.submitted_snapshot_json,
   'originalReviewContext',v.review_context_snapshot,
   'acceptedAmendments',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'amendmentId',a.publication_review_amendment_id,'amendmentNo',a.amendment_no,'findingId',a.publication_review_finding_id,
      'summary',a.summary,'before',a.base_target_snapshot,'proposedChanges',a.proposed_change_set,
      'effectiveTarget',a.base_target_snapshot||a.proposed_change_set,'reviewerComment',a.reviewer_comment
    ) ORDER BY a.amendment_no) FROM professional.publication_review_amendments a WHERE a.profile_publication_request_id=p_request_id AND a.status_code='ACCEPTED'),'[]'::jsonb),
   'resolvedFindings',coalesce((SELECT jsonb_agg(jsonb_build_object('findingId',f.publication_review_finding_id,'findingNo',f.finding_no,'severity',f.severity_code,'status',f.status_code,'resolutionComment',f.resolution_comment) ORDER BY f.finding_no) FROM professional.publication_review_findings f WHERE f.profile_publication_request_id=p_request_id AND f.status_code='RESOLVED'),'[]'::jsonb),
   'sourceStateHash',v_source_hash,
   'originalSnapshotsPreserved',true
 );
 v_integrity:=encode(digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex')::char(64);
 INSERT INTO professional.publication_review_consolidated_snapshots(publication_review_consolidated_snapshot_id,profile_publication_request_id,snapshot_version_no,consolidated_snapshot,source_state_hash_sha256,integrity_hash_sha256,accepted_amendment_count,created_by_party_id)
 VALUES(v_id,p_request_id,v_version,v_snapshot,v_source_hash,v_integrity,v_count,p_reviewer_party_id);
 UPDATE professional.profile_publication_requests SET consolidated_snapshot_id=v_id,updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVIEW_CONSOLIDATED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','publication_review_consolidated_snapshot',v_id,p_correlation_id,'SUCCESS','CRITICAL','CONSOLIDATED',jsonb_build_object('request_id',p_request_id,'snapshot_version',v_version,'accepted_amendments',v_count,'source_state_hash',v_source_hash,'integrity_hash',v_integrity));
 RETURN QUERY SELECT v_id,v_integrity;
END;$$;

CREATE OR REPLACE FUNCTION professional.recommend_profile_publication(p_request_id uuid,p_reviewer_party_id uuid,p_user_account_id uuid,p_recommendation varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_status varchar;v_consolidated professional.publication_review_consolidated_snapshots%ROWTYPE;
BEGIN IF upper(p_recommendation) NOT IN('APPROVE','REJECT') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid recommendation required';END IF;
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id AND reviewer_party_id=p_reviewer_party_id AND status_code='UNDER_REVIEW' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Assigned review unavailable';END IF;
 SELECT * INTO v_consolidated FROM professional.publication_review_consolidated_snapshots WHERE publication_review_consolidated_snapshot_id=v.consolidated_snapshot_id AND profile_publication_request_id=p_request_id;
 IF NOT FOUND OR v_consolidated.source_state_hash_sha256<>professional.publication_review_source_state_hash(p_request_id) OR v_consolidated.integrity_hash_sha256<>encode(digest(convert_to(v_consolidated.consolidated_snapshot::text,'UTF8'),'sha256'),'hex')::char(64) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Current integrity-verified consolidated snapshot is required';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_amendments WHERE profile_publication_request_id=p_request_id AND status_code='SUBMITTED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Pending amendments must be decided before recommendation';END IF;
 IF EXISTS(SELECT 1 FROM professional.publication_review_findings WHERE profile_publication_request_id=p_request_id AND severity_code IN('MAJOR','CRITICAL') AND status_code<>'RESOLVED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Substantive review findings must be resolved before recommendation';END IF;
 v_status:=CASE WHEN upper(p_recommendation)='APPROVE' THEN 'RECOMMENDED' ELSE 'REJECT_RECOMMENDED' END;
 UPDATE professional.profile_publication_requests SET status_code=v_status,review_comment=btrim(p_comment),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_REVIEW_COMPLETED',p_reviewer_party_id,p_user_account_id,'PLATFORM_OPERATOR','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','HIGH',v_status,jsonb_build_object('consolidated_snapshot_id',v_consolidated.publication_review_consolidated_snapshot_id,'integrity_hash',v_consolidated.integrity_hash_sha256));RETURN p_request_id;END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0800_v113_backend_amendment_consolidation') ON CONFLICT DO NOTHING;
COMMIT;
