BEGIN;

CREATE INDEX IF NOT EXISTS idx_evidence_links_target
  ON evidence.evidence_links(target_entity_type,target_entity_id);

CREATE OR REPLACE FUNCTION evidence.link_owned_professional_evidence(
  p_evidence_item_id uuid,p_target_entity_type varchar,p_target_entity_id uuid,
  p_owner_party_id uuid,p_user_account_id uuid,p_relationship_code varchar,
  p_relevance_score numeric,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,evidence,professional,governance AS $$
DECLARE v_type varchar(80):=upper(btrim(p_target_entity_type));v_link_id uuid:=gen_random_uuid();v_owned boolean:=false;
BEGIN
 IF v_type NOT IN('ACADEMIC_QUALIFICATION','EMPLOYMENT_EXPERIENCE','PROJECT_EXPERIENCE','CONSULTING_EXPERIENCE','TRAINING_EXPERIENCE','RESEARCH_EXPERIENCE','PROFESSIONAL_FINGERPRINT')
    OR upper(p_relationship_code) NOT IN('SUPPORTS','PROVES','UPDATES','REPLACES')
    OR p_relevance_score IS NULL OR p_relevance_score<0 OR p_relevance_score>1 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid professional evidence link';END IF;
 IF NOT EXISTS(SELECT 1 FROM evidence.evidence_items e WHERE e.evidence_item_id=p_evidence_item_id AND e.owner_party_id=p_owner_party_id AND e.status_code NOT IN('REJECTED','REVOKED','SUPERSEDED')
   AND EXISTS(SELECT 1 FROM evidence.evidence_files ef JOIN core.files f ON f.file_id=ef.file_id WHERE ef.evidence_item_id=e.evidence_item_id AND f.scan_status_code='SAFE' AND f.archived_at IS NULL)) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owned safe evidence is required';END IF;
 v_owned:=CASE v_type
  WHEN 'ACADEMIC_QUALIFICATION' THEN EXISTS(SELECT 1 FROM professional.academic_qualifications x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.academic_qualification_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'EMPLOYMENT_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.employment_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.employment_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'PROJECT_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.project_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.project_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'CONSULTING_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.consulting_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.consulting_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'TRAINING_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.training_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.training_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'RESEARCH_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.research_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.research_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'PROFESSIONAL_FINGERPRINT' THEN EXISTS(SELECT 1 FROM professional.professional_fingerprints x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.professional_fingerprint_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.status_code<>'ARCHIVED')
  ELSE false END;
 IF NOT v_owned THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Owned professional target not found';END IF;
 INSERT INTO evidence.evidence_links(evidence_link_id,evidence_item_id,target_entity_type,target_entity_id,relationship_code,relevance_score)
 VALUES(v_link_id,p_evidence_item_id,v_type,p_target_entity_id,upper(p_relationship_code),p_relevance_score);
 PERFORM governance.append_audit_event('EVIDENCE','PROFESSIONAL_EVIDENCE_LINKED',p_owner_party_id,p_user_account_id,'MEMBER_SELF',lower(v_type),p_target_entity_id,p_correlation_id,'SUCCESS','HIGH',upper(p_relationship_code),jsonb_build_object('evidence_item_id',p_evidence_item_id,'evidence_link_id',v_link_id,'relevance_score',p_relevance_score));
 RETURN v_link_id;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0710_v113_backend_professional_evidence_links') ON CONFLICT DO NOTHING;
COMMIT;
