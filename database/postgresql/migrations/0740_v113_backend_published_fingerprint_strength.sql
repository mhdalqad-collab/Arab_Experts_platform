BEGIN;
CREATE TABLE professional.published_fingerprint_strengths(
 professional_fingerprint_id uuid PRIMARY KEY REFERENCES professional.professional_fingerprints(professional_fingerprint_id) ON DELETE CASCADE,
 professional_profile_id uuid NOT NULL REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
 source_assessment_id uuid NOT NULL REFERENCES professional.fingerprint_strength_assessments(fingerprint_strength_assessment_id) ON DELETE RESTRICT,
 publication_request_id uuid NOT NULL REFERENCES professional.profile_publication_requests(profile_publication_request_id) ON DELETE RESTRICT,
 composite_score numeric(6,5) NOT NULL CHECK(composite_score BETWEEN 0 AND 1),evidence_score numeric(6,5) NOT NULL CHECK(evidence_score BETWEEN 0 AND 1),context_diversity_score numeric(6,5) NOT NULL CHECK(context_diversity_score BETWEEN 0 AND 1),role_contribution_score numeric(6,5) NOT NULL CHECK(role_contribution_score BETWEEN 0 AND 1),practice_recency_score numeric(6,5) NOT NULL CHECK(practice_recency_score BETWEEN 0 AND 1),confidence_band_code varchar(20) NOT NULL,published_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_published_strength_profile ON professional.published_fingerprint_strengths(professional_profile_id);

CREATE OR REPLACE FUNCTION professional.snapshot_approved_fingerprint_strengths() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,professional AS $$
BEGIN
 IF NEW.status_code='APPROVED' AND OLD.status_code IS DISTINCT FROM 'APPROVED' THEN
  DELETE FROM professional.published_fingerprint_strengths WHERE professional_profile_id=NEW.professional_profile_id;
  INSERT INTO professional.published_fingerprint_strengths(professional_fingerprint_id,professional_profile_id,source_assessment_id,publication_request_id,composite_score,evidence_score,context_diversity_score,role_contribution_score,practice_recency_score,confidence_band_code)
  SELECT f.professional_fingerprint_id,f.professional_profile_id,a.fingerprint_strength_assessment_id,NEW.profile_publication_request_id,a.composite_score,a.evidence_score,a.context_diversity_score,a.role_contribution_score,a.practice_recency_score,a.confidence_band_code
  FROM professional.professional_fingerprints f JOIN professional.fingerprint_strength_assessments a ON a.professional_fingerprint_id=f.professional_fingerprint_id AND a.is_current
  WHERE f.professional_profile_id=NEW.professional_profile_id AND f.status_code IN('ACTIVE','UPDATE_REQUIRED');
 END IF;RETURN NEW;
END;$$;
CREATE TRIGGER trg_snapshot_approved_fingerprint_strengths AFTER UPDATE OF status_code ON professional.profile_publication_requests FOR EACH ROW EXECUTE FUNCTION professional.snapshot_approved_fingerprint_strengths();
INSERT INTO integration.schema_migrations(migration_name) VALUES('0740_v113_backend_published_fingerprint_strength') ON CONFLICT DO NOTHING;COMMIT;
