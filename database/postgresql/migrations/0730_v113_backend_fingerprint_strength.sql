BEGIN;
CREATE TABLE professional.fingerprint_strength_assessments(
 fingerprint_strength_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),professional_fingerprint_id uuid NOT NULL REFERENCES professional.professional_fingerprints(professional_fingerprint_id) ON DELETE CASCADE,owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
 composite_score numeric(6,5) NOT NULL CHECK(composite_score BETWEEN 0 AND 1),evidence_score numeric(6,5) NOT NULL CHECK(evidence_score BETWEEN 0 AND 1),context_diversity_score numeric(6,5) NOT NULL CHECK(context_diversity_score BETWEEN 0 AND 1),role_contribution_score numeric(6,5) NOT NULL CHECK(role_contribution_score BETWEEN 0 AND 1),practice_recency_score numeric(6,5) NOT NULL CHECK(practice_recency_score BETWEEN 0 AND 1),
 confidence_band_code varchar(20) NOT NULL CHECK(confidence_band_code IN('LOW','MODERATE','HIGH','VERY_HIGH')),calculation_snapshot jsonb NOT NULL,is_current boolean NOT NULL DEFAULT true,assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id)
);
CREATE UNIQUE INDEX uq_current_fingerprint_strength ON professional.fingerprint_strength_assessments(professional_fingerprint_id) WHERE is_current;
CREATE INDEX idx_owner_fingerprint_strength ON professional.fingerprint_strength_assessments(owner_party_id,is_current,assessed_at DESC);

CREATE OR REPLACE FUNCTION professional.recalculate_owned_fingerprint_strength(p_owner_party_id uuid,p_user_account_id uuid,p_fingerprint_id uuid,p_correlation_id varchar DEFAULT NULL)
RETURNS TABLE(assessment_id uuid,composite_score numeric,evidence_score numeric,context_diversity_score numeric,role_contribution_score numeric,practice_recency_score numeric,confidence_band_code varchar)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,reference,governance AS $$
DECLARE v_fp professional.professional_fingerprints%ROWTYPE;v_evidence numeric:=0;v_context numeric:=0;v_role numeric:=0;v_recency numeric:=.4;v_composite numeric;v_band varchar(20);v_id uuid:=gen_random_uuid();v_context_count int:=0;v_latest date;v_snapshot jsonb;
BEGIN
 SELECT f.* INTO v_fp FROM professional.professional_fingerprints f JOIN professional.professional_profiles p USING(professional_profile_id) WHERE f.professional_fingerprint_id=p_fingerprint_id AND p.party_id=p_owner_party_id AND f.status_code<>'ARCHIVED';
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Owned fingerprint not found';END IF;
 SELECT coalesce(a.strength_score,0) INTO v_evidence FROM professional.evidence_strength_assessments a WHERE a.target_entity_type='PROFESSIONAL_FINGERPRINT' AND a.target_entity_id=p_fingerprint_id AND a.is_current;
 SELECT count(DISTINCT context_type_code),max(coalesce(last_observed_at,first_observed_at)) INTO v_context_count,v_latest FROM professional.fingerprint_contexts WHERE professional_fingerprint_id=p_fingerprint_id;
 v_context:=least(1,v_context_count::numeric/4);
 SELECT coalesce(responsibility_weight,0)::numeric/100 INTO v_role FROM reference.expert_roles WHERE expert_role_code=v_fp.expert_role_code;
 SELECT greatest(v_latest,max(achieved_at)) INTO v_latest FROM professional.fingerprint_outcomes WHERE professional_fingerprint_id=p_fingerprint_id;
 IF v_latest IS NOT NULL THEN v_recency:=greatest(.4,1-(greatest(0,extract(year FROM age(current_date,v_latest)))*.08));END IF;
 v_composite:=least(1,greatest(0,v_evidence*.45+v_context*.20+v_role*.15+v_recency*.20));
 v_band:=CASE WHEN v_composite<.35 THEN 'LOW' WHEN v_composite<.60 THEN 'MODERATE' WHEN v_composite<.80 THEN 'HIGH' ELSE 'VERY_HIGH' END;
 v_snapshot:=jsonb_build_object('formulaVersion','V113_FINGERPRINT_STRENGTH_1','weights',jsonb_build_object('evidence',.45,'contextDiversity',.20,'roleContribution',.15,'practiceRecency',.20),'contextTypeCount',v_context_count,'latestPracticeDate',v_latest,'inputs',jsonb_build_object('evidenceScore',v_evidence,'contextDiversityScore',v_context,'roleContributionScore',v_role,'practiceRecencyScore',v_recency));
 UPDATE professional.fingerprint_strength_assessments SET is_current=false WHERE professional_fingerprint_id=p_fingerprint_id AND is_current;
 INSERT INTO professional.fingerprint_strength_assessments(fingerprint_strength_assessment_id,professional_fingerprint_id,owner_party_id,composite_score,evidence_score,context_diversity_score,role_contribution_score,practice_recency_score,confidence_band_code,calculation_snapshot,assessed_by_party_id) VALUES(v_id,p_fingerprint_id,p_owner_party_id,v_composite,v_evidence,v_context,v_role,v_recency,v_band,v_snapshot,p_owner_party_id);
 PERFORM governance.append_audit_event('PROFESSIONAL','FINGERPRINT_STRENGTH_RECALCULATED',p_owner_party_id,p_user_account_id,'MEMBER_SELF','professional_fingerprint',p_fingerprint_id,p_correlation_id,'SUCCESS','MEDIUM',v_band,jsonb_build_object('assessment_id',v_id,'composite_score',v_composite));
 RETURN QUERY SELECT v_id,v_composite,v_evidence,v_context,v_role,v_recency,v_band;
END;$$;
INSERT INTO integration.schema_migrations(migration_name) VALUES('0730_v113_backend_fingerprint_strength') ON CONFLICT DO NOTHING;COMMIT;
