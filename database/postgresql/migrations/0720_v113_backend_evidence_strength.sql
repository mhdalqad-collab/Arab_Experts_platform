BEGIN;
CREATE TABLE professional.evidence_strength_assessments(
 evidence_strength_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),target_entity_type varchar(80) NOT NULL,target_entity_id uuid NOT NULL,
 strength_score numeric(6,5) NOT NULL CHECK(strength_score BETWEEN 0 AND 1),confidence_band_code varchar(20) NOT NULL CHECK(confidence_band_code IN('NONE','LOW','MODERATE','HIGH','VERY_HIGH')),
 distinct_evidence_count integer NOT NULL CHECK(distinct_evidence_count>=0),verified_evidence_count integer NOT NULL CHECK(verified_evidence_count>=0),calculation_snapshot jsonb NOT NULL,is_current boolean NOT NULL DEFAULT true,assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id)
);
CREATE UNIQUE INDEX uq_current_evidence_strength ON professional.evidence_strength_assessments(target_entity_type,target_entity_id) WHERE is_current;
CREATE INDEX idx_owner_evidence_strength ON professional.evidence_strength_assessments(owner_party_id,is_current,assessed_at DESC);

CREATE OR REPLACE FUNCTION professional.recalculate_owned_evidence_strength(p_owner_party_id uuid,p_user_account_id uuid,p_target_entity_type varchar,p_target_entity_id uuid,p_correlation_id varchar DEFAULT NULL)
RETURNS TABLE(assessment_id uuid,strength_score numeric,confidence_band_code varchar,distinct_evidence_count integer,verified_evidence_count integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,evidence,professional,governance AS $$
DECLARE v_type varchar(80):=upper(btrim(p_target_entity_type));v_owned boolean:=false;v_score numeric:=0;v_count integer:=0;v_verified integer:=0;v_band varchar(20);v_id uuid:=gen_random_uuid();v_snapshot jsonb;
BEGIN
 v_owned:=CASE v_type
  WHEN 'ACADEMIC_QUALIFICATION' THEN EXISTS(SELECT 1 FROM professional.academic_qualifications x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.academic_qualification_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'EMPLOYMENT_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.employment_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.employment_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'PROJECT_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.project_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.project_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'CONSULTING_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.consulting_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.consulting_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'TRAINING_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.training_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.training_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'RESEARCH_EXPERIENCE' THEN EXISTS(SELECT 1 FROM professional.research_experiences x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.research_experience_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.archived_at IS NULL)
  WHEN 'PROFESSIONAL_FINGERPRINT' THEN EXISTS(SELECT 1 FROM professional.professional_fingerprints x JOIN professional.professional_profiles p USING(professional_profile_id) WHERE x.professional_fingerprint_id=p_target_entity_id AND p.party_id=p_owner_party_id AND x.status_code<>'ARCHIVED') ELSE false END;
 IF NOT v_owned THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Owned professional target not found';END IF;
 WITH unique_evidence AS(
  SELECT e.evidence_item_id,e.status_code,e.issued_at,max(l.relevance_score)::numeric AS relevance,
   CASE e.status_code WHEN 'VERIFIED' THEN 1.0 WHEN 'PARTIALLY_VERIFIED' THEN .65 WHEN 'VERIFICATION_PENDING' THEN .35 ELSE .20 END::numeric AS verification_weight,
   greatest(.40,1.0-(greatest(0,extract(year FROM age(current_date,coalesce(e.issued_at,current_date))))*.05))::numeric AS recency_weight
  FROM evidence.evidence_links l JOIN evidence.evidence_items e ON e.evidence_item_id=l.evidence_item_id
  WHERE l.target_entity_type=v_type AND l.target_entity_id=p_target_entity_id AND e.owner_party_id=p_owner_party_id AND e.status_code NOT IN('REJECTED','REVOKED','SUPERSEDED')
  GROUP BY e.evidence_item_id,e.status_code,e.issued_at
 ),calc AS(SELECT count(*)::int n,count(*) FILTER(WHERE status_code='VERIFIED')::int verified,coalesce(sum(relevance*verification_weight*recency_weight)/nullif(sum(relevance),0),0)::numeric score,
   coalesce(jsonb_agg(jsonb_build_object('evidenceItemId',evidence_item_id,'statusCode',status_code,'relevance',relevance,'verificationWeight',verification_weight,'recencyWeight',recency_weight) ORDER BY evidence_item_id),'[]'::jsonb) details FROM unique_evidence)
 SELECT n,verified,least(1,greatest(0,score)),jsonb_build_object('formulaVersion','V113_EVIDENCE_STRENGTH_1','deduplication','ONE_CONTRIBUTION_PER_EVIDENCE_ITEM','evidence',details) INTO v_count,v_verified,v_score,v_snapshot FROM calc;
 v_band:=CASE WHEN v_count=0 THEN 'NONE' WHEN v_score<.35 THEN 'LOW' WHEN v_score<.60 THEN 'MODERATE' WHEN v_score<.80 THEN 'HIGH' ELSE 'VERY_HIGH' END;
 UPDATE professional.evidence_strength_assessments SET is_current=false WHERE target_entity_type=v_type AND target_entity_id=p_target_entity_id AND is_current;
 INSERT INTO professional.evidence_strength_assessments(evidence_strength_assessment_id,owner_party_id,target_entity_type,target_entity_id,strength_score,confidence_band_code,distinct_evidence_count,verified_evidence_count,calculation_snapshot,assessed_by_party_id) VALUES(v_id,p_owner_party_id,v_type,p_target_entity_id,v_score,v_band,v_count,v_verified,v_snapshot,p_owner_party_id);
 PERFORM governance.append_audit_event('EVIDENCE','EVIDENCE_STRENGTH_RECALCULATED',p_owner_party_id,p_user_account_id,'MEMBER_SELF',lower(v_type),p_target_entity_id,p_correlation_id,'SUCCESS','MEDIUM',v_band,jsonb_build_object('assessment_id',v_id,'score',v_score,'distinct_evidence_count',v_count));
 RETURN QUERY SELECT v_id,v_score,v_band,v_count,v_verified;
END;$$;
INSERT INTO integration.schema_migrations(migration_name) VALUES('0720_v113_backend_evidence_strength') ON CONFLICT DO NOTHING;COMMIT;
