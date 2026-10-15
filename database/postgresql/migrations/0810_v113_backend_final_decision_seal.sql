BEGIN;

CREATE TABLE professional.published_profile_materializations(
  published_profile_materialization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE RESTRICT,
  profile_publication_request_id uuid NOT NULL UNIQUE REFERENCES professional.profile_publication_requests(profile_publication_request_id) ON DELETE RESTRICT,
  consolidated_snapshot_id uuid NOT NULL REFERENCES professional.publication_review_consolidated_snapshots(publication_review_consolidated_snapshot_id) ON DELETE RESTRICT,
  publication_version_no integer NOT NULL CHECK(publication_version_no>0),
  sealed_snapshot jsonb NOT NULL,
  public_projection jsonb NOT NULL,
  consolidated_integrity_hash_sha256 char(64) NOT NULL,
  decision_seal_hash_sha256 char(64) NOT NULL UNIQUE,
  decided_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  decision_comment text NOT NULL,
  decided_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(professional_profile_id,publication_version_no),
  CHECK((is_active AND superseded_at IS NULL) OR (NOT is_active AND superseded_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_active_published_profile_materialization ON professional.published_profile_materializations(professional_profile_id) WHERE is_active;
ALTER TABLE professional.profile_publication_requests ADD COLUMN IF NOT EXISTS decision_seal_hash_sha256 char(64),ADD COLUMN IF NOT EXISTS published_materialization_id uuid REFERENCES professional.published_profile_materializations(published_profile_materialization_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION professional.protect_published_profile_materialization() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Published materializations are immutable';END IF;
 IF OLD.published_profile_materialization_id<>NEW.published_profile_materialization_id OR OLD.professional_profile_id<>NEW.professional_profile_id OR OLD.profile_publication_request_id<>NEW.profile_publication_request_id OR OLD.consolidated_snapshot_id<>NEW.consolidated_snapshot_id OR OLD.publication_version_no<>NEW.publication_version_no OR OLD.sealed_snapshot<>NEW.sealed_snapshot OR OLD.public_projection<>NEW.public_projection OR OLD.consolidated_integrity_hash_sha256<>NEW.consolidated_integrity_hash_sha256 OR OLD.decision_seal_hash_sha256<>NEW.decision_seal_hash_sha256 OR OLD.decided_by_party_id<>NEW.decided_by_party_id OR OLD.decision_comment<>NEW.decision_comment OR OLD.decided_at<>NEW.decided_at OR OLD.created_at<>NEW.created_at OR OLD.is_active=false OR NEW.is_active OR NEW.superseded_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Published materialization mutation is forbidden';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER trg_protect_published_profile_materialization BEFORE UPDATE OR DELETE ON professional.published_profile_materializations FOR EACH ROW EXECUTE FUNCTION professional.protect_published_profile_materialization();

ALTER FUNCTION professional.decide_profile_publication(uuid,uuid,uuid,varchar,text,varchar) RENAME TO decide_profile_publication_pre0810;
CREATE OR REPLACE FUNCTION professional.decide_profile_publication(p_request_id uuid,p_decider_party_id uuid,p_user_account_id uuid,p_decision varchar,p_comment text,p_correlation_id varchar DEFAULT NULL) RETURNS varchar
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,core,professional,taxonomy,governance AS $$
DECLARE v professional.profile_publication_requests%ROWTYPE;v_consolidated professional.publication_review_consolidated_snapshots%ROWTYPE;v_status varchar;v_profile_status varchar;v_decided_at timestamptz:=clock_timestamp();v_materialization_id uuid;v_version integer;v_profile jsonb;v_fingerprints jsonb;v_public jsonb;v_sealed jsonb;v_seal char(64);
BEGIN
 IF upper(p_decision) NOT IN('APPROVED','REJECTED') OR nullif(btrim(p_comment),'') IS NULL OR length(p_comment)>2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid decision required';END IF;
 SELECT * INTO v FROM professional.profile_publication_requests WHERE profile_publication_request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v.status_code NOT IN('RECOMMENDED','REJECT_RECOMMENDED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Completed review required';END IF;
 IF v.requested_by_party_id=p_decider_party_id OR v.reviewer_party_id=p_decider_party_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Separation of duties violation';END IF;
 IF (upper(p_decision)='APPROVED' AND v.status_code<>'RECOMMENDED') OR (upper(p_decision)='REJECTED' AND v.status_code<>'REJECT_RECOMMENDED') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Decision must match recommendation';END IF;
 SELECT * INTO v_consolidated FROM professional.publication_review_consolidated_snapshots WHERE publication_review_consolidated_snapshot_id=v.consolidated_snapshot_id AND profile_publication_request_id=p_request_id;
 IF NOT FOUND OR v_consolidated.source_state_hash_sha256<>professional.publication_review_source_state_hash(p_request_id) OR v_consolidated.integrity_hash_sha256<>encode(digest(convert_to(v_consolidated.consolidated_snapshot::text,'UTF8'),'sha256'),'hex')::char(64) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Consolidated snapshot integrity validation failed';END IF;
 v_status:=upper(p_decision);v_profile_status:=CASE WHEN v_status='APPROVED' THEN 'PUBLISHED' ELSE 'UPDATE_REQUIRED' END;
 IF v_status='APPROVED' THEN
   SELECT to_jsonb(pp) INTO v_profile FROM professional.professional_profiles pp WHERE pp.professional_profile_id=v.professional_profile_id;
   SELECT coalesce(v_profile||jsonb_object_agg(e.key,e.value ORDER BY a.amendment_no),v_profile) INTO v_profile
   FROM professional.publication_review_amendments a JOIN professional.publication_review_findings f USING(publication_review_finding_id) CROSS JOIN LATERAL jsonb_each(a.proposed_change_set) e
   WHERE a.profile_publication_request_id=p_request_id AND a.status_code='ACCEPTED' AND f.target_type_code='PROFILE';
   SELECT coalesce(jsonb_agg(jsonb_build_object('professionalFingerprintId',x.professional_fingerprint_id,'code',coalesce(x.effective->>'fingerprint_code',x.effective->>'fingerprintCode'),'titleAr',coalesce(x.effective->>'title_ar',x.effective->>'titleAr'),'titleEn',coalesce(x.effective->>'title_en',x.effective->>'titleEn'),'taxonomyNodeCode',x.node_code,'taxonomyNameAr',x.name_ar,'taxonomyNameEn',x.name_en,'experienceLevelCode',coalesce(x.effective->>'experience_level_code',x.effective->>'experienceLevelCode'),'expertRoleCode',coalesce(x.effective->>'expert_role_code',x.effective->>'expertRoleCode')) ORDER BY coalesce(x.effective->>'fingerprint_code',x.effective->>'fingerprintCode')),'[]'::jsonb) INTO v_fingerprints
   FROM (SELECT pf.professional_fingerprint_id,tn.node_code,tn.name_ar,tn.name_en,to_jsonb(pf)||coalesce((SELECT jsonb_object_agg(e.key,e.value ORDER BY a.amendment_no) FROM professional.publication_review_amendments a JOIN professional.publication_review_findings f USING(publication_review_finding_id) CROSS JOIN LATERAL jsonb_each(a.proposed_change_set) e WHERE a.profile_publication_request_id=p_request_id AND a.status_code='ACCEPTED' AND f.target_type_code='FINGERPRINT' AND f.target_entity_id=pf.professional_fingerprint_id),'{}'::jsonb) AS effective FROM professional.professional_fingerprints pf JOIN taxonomy.taxonomy_nodes tn ON tn.taxonomy_node_id=pf.primary_taxonomy_node_id WHERE pf.professional_profile_id=v.professional_profile_id AND pf.status_code IN('ACTIVE','UPDATE_REQUIRED')) x;
   v_public:=jsonb_build_object('professionalProfileId',v.professional_profile_id,'partyId',v.requested_by_party_id,'currentJobTitleAr',coalesce(v_profile->>'current_job_title_ar',v_profile->>'currentJobTitleAr'),'currentJobTitleEn',coalesce(v_profile->>'current_job_title_en',v_profile->>'currentJobTitleEn'),'totalExperienceYears',coalesce(v_profile->'total_professional_experience_years',v_profile->'totalExperienceYears'),'fingerprints',v_fingerprints);
   v_materialization_id:=gen_random_uuid();SELECT coalesce(max(publication_version_no),0)+1 INTO v_version FROM professional.published_profile_materializations WHERE professional_profile_id=v.professional_profile_id;
   v_sealed:=jsonb_build_object('snapshotVersion','V113_SEALED_PUBLICATION_1','consolidatedSnapshotId',v.consolidated_snapshot_id,'consolidatedIntegrityHash',v_consolidated.integrity_hash_sha256,'consolidatedSnapshot',v_consolidated.consolidated_snapshot,'publicProjection',v_public,'decision',jsonb_build_object('status','APPROVED','decidedByPartyId',p_decider_party_id,'decidedAt',v_decided_at,'comment',btrim(p_comment)));
   v_seal:=encode(digest(convert_to(v_sealed::text,'UTF8'),'sha256'),'hex')::char(64);
   UPDATE professional.published_profile_materializations SET is_active=false,superseded_at=v_decided_at WHERE professional_profile_id=v.professional_profile_id AND is_active;
   INSERT INTO professional.published_profile_materializations(published_profile_materialization_id,professional_profile_id,profile_publication_request_id,consolidated_snapshot_id,publication_version_no,sealed_snapshot,public_projection,consolidated_integrity_hash_sha256,decision_seal_hash_sha256,decided_by_party_id,decision_comment,decided_at) VALUES(v_materialization_id,v.professional_profile_id,p_request_id,v.consolidated_snapshot_id,v_version,v_sealed,v_public,v_consolidated.integrity_hash_sha256,v_seal,p_decider_party_id,btrim(p_comment),v_decided_at);
 END IF;
 UPDATE professional.profile_publication_requests SET status_code=v_status,decided_by_party_id=p_decider_party_id,decision_comment=btrim(p_comment),decided_at=v_decided_at,decision_seal_hash_sha256=v_seal,published_materialization_id=v_materialization_id,updated_at=clock_timestamp() WHERE profile_publication_request_id=p_request_id;
 PERFORM set_config('eim.transition_context','allowed',true);UPDATE professional.professional_profiles SET status_code=v_profile_status WHERE professional_profile_id=v.professional_profile_id;
 IF v_status='APPROVED' THEN UPDATE professional.professional_fingerprints SET status_code='ACTIVE' WHERE professional_profile_id=v.professional_profile_id AND status_code='UPDATE_REQUIRED';END IF;
 PERFORM governance.append_audit_event('PROFESSIONAL','PROFILE_PUBLICATION_DECIDED',p_decider_party_id,p_user_account_id,'PLATFORM_ADMIN','profile_publication_request',p_request_id,p_correlation_id,'SUCCESS','CRITICAL',v_status,jsonb_build_object('profile_status',v_profile_status,'materialization_id',v_materialization_id,'decision_seal_hash',v_seal,'consolidated_integrity_hash',v_consolidated.integrity_hash_sha256));RETURN v_status;
END;$$;

ALTER FUNCTION professional.search_public_directory(text,varchar,varchar,varchar,varchar,integer,integer) RENAME TO search_public_directory_pre0810;
CREATE OR REPLACE FUNCTION professional.search_public_directory(
  p_query text DEFAULT NULL,p_membership_type_code varchar DEFAULT NULL,p_taxonomy_node_code varchar DEFAULT NULL,
  p_experience_level_code varchar DEFAULT NULL,p_expert_role_code varchar DEFAULT NULL,p_limit integer DEFAULT 20,p_offset integer DEFAULT 0
) RETURNS TABLE(party_id uuid,display_name_ar text,display_name_en text,current_job_title_ar text,current_job_title_en text,total_experience_years integer,membership_types jsonb,fingerprints jsonb,total_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,core,governance,membership,professional,taxonomy AS $$
 WITH eligible AS (
  SELECT pm.professional_profile_id,(pm.public_projection->>'partyId')::uuid AS party_id,pm.public_projection,
   CASE WHEN EXISTS(SELECT 1 FROM governance.field_privacy_preferences f WHERE f.owner_party_id=(pm.public_projection->>'partyId')::uuid AND f.resource_type='PARTY_PROFILE' AND f.resource_id=(pm.public_projection->>'partyId')::uuid AND f.field_path='display_name_ar' AND f.visibility_code='PUBLIC' AND f.valid_to IS NULL) THEN pe.display_name_ar END AS display_name_ar,
   CASE WHEN EXISTS(SELECT 1 FROM governance.field_privacy_preferences f WHERE f.owner_party_id=(pm.public_projection->>'partyId')::uuid AND f.resource_type='PARTY_PROFILE' AND f.resource_id=(pm.public_projection->>'partyId')::uuid AND f.field_path='display_name_en' AND f.visibility_code='PUBLIC' AND f.valid_to IS NULL) THEN pe.display_name_en END AS display_name_en
  FROM professional.published_profile_materializations pm JOIN core.parties pe ON pe.party_id=(pm.public_projection->>'partyId')::uuid AND pe.status_code='ACTIVE' AND pe.archived_at IS NULL
  WHERE pm.is_active
   AND pm.decision_seal_hash_sha256=encode(digest(convert_to(pm.sealed_snapshot::text,'UTF8'),'sha256'),'hex')::char(64)
   AND EXISTS(SELECT 1 FROM membership.memberships m JOIN membership.membership_types mt ON mt.membership_type_id=m.membership_type_id WHERE m.party_id=(pm.public_projection->>'partyId')::uuid AND m.status_code='ACTIVE' AND (m.valid_from IS NULL OR m.valid_from<=CURRENT_DATE) AND (m.valid_to IS NULL OR m.valid_to>=CURRENT_DATE) AND (p_membership_type_code IS NULL OR mt.membership_type_code=p_membership_type_code))
   AND (p_experience_level_code IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(pm.public_projection->'fingerprints','[]'::jsonb)) f WHERE f->>'experienceLevelCode'=p_experience_level_code))
   AND (p_expert_role_code IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(pm.public_projection->'fingerprints','[]'::jsonb)) f WHERE f->>'expertRoleCode'=p_expert_role_code))
   AND (p_taxonomy_node_code IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(pm.public_projection->'fingerprints','[]'::jsonb)) f JOIN taxonomy.taxonomy_nodes tn ON tn.node_code=f->>'taxonomyNodeCode' AND tn.status_code='ACTIVE' JOIN taxonomy.taxonomy_nodes requested ON requested.taxonomy_version_id=tn.taxonomy_version_id AND requested.node_code=p_taxonomy_node_code AND requested.status_code='ACTIVE' WHERE tn.path_code=requested.path_code OR tn.path_code LIKE requested.path_code||'/%'))
 ),searched AS (
  SELECT * FROM eligible e WHERE p_query IS NULL OR btrim(p_query)='' OR coalesce(e.display_name_ar,'') ILIKE '%'||btrim(p_query)||'%' OR coalesce(e.display_name_en,'') ILIKE '%'||btrim(p_query)||'%' OR coalesce(e.public_projection->>'currentJobTitleAr','') ILIKE '%'||btrim(p_query)||'%' OR coalesce(e.public_projection->>'currentJobTitleEn','') ILIKE '%'||btrim(p_query)||'%' OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(e.public_projection->'fingerprints','[]'::jsonb)) f WHERE coalesce(f->>'titleAr','') ILIKE '%'||btrim(p_query)||'%' OR coalesce(f->>'titleEn','') ILIKE '%'||btrim(p_query)||'%' OR coalesce(f->>'taxonomyNameAr','') ILIKE '%'||btrim(p_query)||'%' OR coalesce(f->>'taxonomyNameEn','') ILIKE '%'||btrim(p_query)||'%')
 )
 SELECT s.party_id,s.display_name_ar,s.display_name_en,s.public_projection->>'currentJobTitleAr',s.public_projection->>'currentJobTitleEn',(s.public_projection->>'totalExperienceYears')::integer,
  coalesce((SELECT jsonb_agg(jsonb_build_object('code',mt.membership_type_code,'nameAr',mt.name_ar,'nameEn',mt.name_en) ORDER BY mt.display_order) FROM membership.memberships mm JOIN membership.membership_types mt ON mt.membership_type_id=mm.membership_type_id WHERE mm.party_id=s.party_id AND mm.status_code='ACTIVE' AND (mm.valid_from IS NULL OR mm.valid_from<=CURRENT_DATE) AND (mm.valid_to IS NULL OR mm.valid_to>=CURRENT_DATE)),'[]'::jsonb),
  coalesce(s.public_projection->'fingerprints','[]'::jsonb),count(*) OVER()
 FROM searched s ORDER BY coalesce(s.display_name_ar,s.display_name_en,s.public_projection->>'currentJobTitleAr',s.party_id::text),s.party_id LIMIT LEAST(GREATEST(p_limit,1),50) OFFSET GREATEST(p_offset,0);
$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0810_v113_backend_final_decision_seal') ON CONFLICT DO NOTHING;
COMMIT;
