BEGIN;
ALTER TABLE professional.profile_publication_requests ADD COLUMN IF NOT EXISTS review_context_snapshot jsonb;

CREATE OR REPLACE FUNCTION professional.enforce_profile_publication_readiness() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,evidence,professional AS $$
DECLARE v jsonb;v_strengths jsonb;v_evidence jsonb;
BEGIN
 v:=professional.owned_profile_publication_readiness(NEW.requested_by_party_id);
 IF NOT coalesce((v->>'ready')::boolean,false) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Profile publication readiness requirements are not met',DETAIL=v::text;END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('professionalFingerprintId',f.professional_fingerprint_id,'fingerprintCode',f.fingerprint_code,'titleAr',f.title_ar,'compositeScore',a.composite_score,'confidenceBandCode',a.confidence_band_code,'components',jsonb_build_object('evidence',a.evidence_score,'contextDiversity',a.context_diversity_score,'roleContribution',a.role_contribution_score,'practiceRecency',a.practice_recency_score)) ORDER BY f.fingerprint_code),'[]'::jsonb)
 INTO v_strengths FROM professional.professional_fingerprints f JOIN professional.professional_profiles p USING(professional_profile_id) LEFT JOIN professional.fingerprint_strength_assessments a ON a.professional_fingerprint_id=f.professional_fingerprint_id AND a.is_current WHERE p.party_id=NEW.requested_by_party_id AND f.status_code IN('ACTIVE','UPDATE_REQUIRED');
 SELECT coalesce(jsonb_agg(jsonb_build_object('evidenceItemId',e.evidence_item_id,'evidenceTypeCode',e.evidence_type_code,'titleAr',e.title_ar,'titleEn',e.title_en,'issuedAt',e.issued_at,'expiresAt',e.expires_at,'statusCode',e.status_code,'targetEntityType',l.target_entity_type,'targetEntityId',l.target_entity_id,'relationshipCode',l.relationship_code,'relevanceScore',l.relevance_score) ORDER BY e.created_at),'[]'::jsonb)
 INTO v_evidence FROM evidence.evidence_items e JOIN evidence.evidence_links l ON l.evidence_item_id=e.evidence_item_id WHERE e.owner_party_id=NEW.requested_by_party_id AND e.status_code IN('VERIFIED','PARTIALLY_VERIFIED');
 NEW.review_context_snapshot:=jsonb_build_object('snapshotVersion','V113_REVIEW_CONTEXT_1','readiness',v,'fingerprintStrengths',v_strengths,'verifiedEvidenceSummaries',v_evidence,'excludes',jsonb_build_array('fileNames','storageKeys','downloadUrls','privateEvidenceDescriptions'));
 RETURN NEW;
END;$$;
INSERT INTO integration.schema_migrations(migration_name) VALUES('0760_v113_backend_publication_review_projection') ON CONFLICT DO NOTHING;COMMIT;
