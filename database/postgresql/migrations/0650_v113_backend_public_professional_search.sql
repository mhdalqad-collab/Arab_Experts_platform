BEGIN;

CREATE INDEX IF NOT EXISTS idx_memberships_public_directory
  ON membership.memberships(party_id, membership_type_id)
  WHERE status_code = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_fingerprints_public_directory
  ON professional.professional_fingerprints(professional_profile_id, primary_taxonomy_node_id)
  WHERE status_code = 'ACTIVE';

CREATE OR REPLACE FUNCTION professional.search_public_directory(
  p_query text DEFAULT NULL,
  p_membership_type_code varchar DEFAULT NULL,
  p_taxonomy_node_code varchar DEFAULT NULL,
  p_experience_level_code varchar DEFAULT NULL,
  p_expert_role_code varchar DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
) RETURNS TABLE(
  party_id uuid,
  display_name_ar text,
  display_name_en text,
  current_job_title_ar text,
  current_job_title_en text,
  total_experience_years integer,
  membership_types jsonb,
  fingerprints jsonb,
  total_count bigint
) LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,core,governance,membership,professional,taxonomy AS $$
  WITH eligible AS (
    SELECT pp.professional_profile_id, pp.party_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM governance.field_privacy_preferences f
        WHERE f.owner_party_id=pp.party_id AND f.resource_type='PARTY_PROFILE'
          AND f.resource_id=pp.party_id AND f.field_path='display_name_ar'
          AND f.visibility_code='PUBLIC' AND f.valid_to IS NULL
      ) THEN pe.display_name_ar END AS display_name_ar,
      CASE WHEN EXISTS (
        SELECT 1 FROM governance.field_privacy_preferences f
        WHERE f.owner_party_id=pp.party_id AND f.resource_type='PARTY_PROFILE'
          AND f.resource_id=pp.party_id AND f.field_path='display_name_en'
          AND f.visibility_code='PUBLIC' AND f.valid_to IS NULL
      ) THEN pe.display_name_en END AS display_name_en,
      pp.current_job_title_ar, pp.current_job_title_en,
      pp.total_professional_experience_years
    FROM professional.professional_profiles pp
    JOIN core.parties pe ON pe.party_id=pp.party_id AND pe.status_code='ACTIVE' AND pe.archived_at IS NULL
    WHERE pp.status_code IN ('PUBLISHED','PARTIALLY_VERIFIED','VERIFIED')
      AND EXISTS (
        SELECT 1 FROM membership.memberships m
        JOIN membership.membership_types mt ON mt.membership_type_id=m.membership_type_id
        WHERE m.party_id=pp.party_id AND m.status_code='ACTIVE'
          AND (m.valid_from IS NULL OR m.valid_from<=CURRENT_DATE)
          AND (m.valid_to IS NULL OR m.valid_to>=CURRENT_DATE)
          AND (p_membership_type_code IS NULL OR mt.membership_type_code=p_membership_type_code)
      )
      AND (p_taxonomy_node_code IS NULL OR EXISTS (
        SELECT 1 FROM professional.professional_fingerprints pf
        JOIN taxonomy.taxonomy_nodes tn ON tn.taxonomy_node_id=pf.primary_taxonomy_node_id
        JOIN taxonomy.taxonomy_versions tv ON tv.taxonomy_version_id=tn.taxonomy_version_id
        JOIN taxonomy.taxonomy_nodes requested ON requested.taxonomy_version_id=tn.taxonomy_version_id
          AND requested.node_code=p_taxonomy_node_code AND requested.status_code='ACTIVE'
        WHERE pf.professional_profile_id=pp.professional_profile_id AND pf.status_code='ACTIVE'
          AND tn.status_code='ACTIVE' AND tv.status_code='PUBLISHED'
          AND (tn.path_code=requested.path_code OR tn.path_code LIKE requested.path_code || '/%')
      ))
      AND (p_experience_level_code IS NULL OR EXISTS (
        SELECT 1 FROM professional.professional_fingerprints pf
        WHERE pf.professional_profile_id=pp.professional_profile_id AND pf.status_code='ACTIVE'
          AND pf.experience_level_code=p_experience_level_code
      ))
      AND (p_expert_role_code IS NULL OR EXISTS (
        SELECT 1 FROM professional.professional_fingerprints pf
        WHERE pf.professional_profile_id=pp.professional_profile_id AND pf.status_code='ACTIVE'
          AND pf.expert_role_code=p_expert_role_code
      ))
  ), searched AS (
    SELECT e.* FROM eligible e
    WHERE p_query IS NULL OR btrim(p_query)='' OR
      coalesce(e.display_name_ar,'') ILIKE '%' || btrim(p_query) || '%' OR
      coalesce(e.display_name_en,'') ILIKE '%' || btrim(p_query) || '%' OR
      coalesce(e.current_job_title_ar,'') ILIKE '%' || btrim(p_query) || '%' OR
      coalesce(e.current_job_title_en,'') ILIKE '%' || btrim(p_query) || '%' OR EXISTS (
        SELECT 1 FROM professional.professional_fingerprints pf
        JOIN taxonomy.taxonomy_nodes tn ON tn.taxonomy_node_id=pf.primary_taxonomy_node_id
        JOIN taxonomy.taxonomy_versions tv ON tv.taxonomy_version_id=tn.taxonomy_version_id
        WHERE pf.professional_profile_id=e.professional_profile_id AND pf.status_code='ACTIVE'
          AND tn.status_code='ACTIVE' AND tv.status_code='PUBLISHED'
          AND (pf.title_ar ILIKE '%' || btrim(p_query) || '%' OR coalesce(pf.title_en,'') ILIKE '%' || btrim(p_query) || '%'
            OR tn.name_ar ILIKE '%' || btrim(p_query) || '%' OR coalesce(tn.name_en,'') ILIKE '%' || btrim(p_query) || '%')
      )
  )
  SELECT s.party_id, s.display_name_ar, s.display_name_en,
    s.current_job_title_ar, s.current_job_title_en, s.total_professional_experience_years,
    coalesce(m.types,'[]'::jsonb), coalesce(f.items,'[]'::jsonb), count(*) OVER()
  FROM searched s
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('code',mt.membership_type_code,'nameAr',mt.name_ar,'nameEn',mt.name_en) ORDER BY mt.display_order) AS types
    FROM membership.memberships mm JOIN membership.membership_types mt ON mt.membership_type_id=mm.membership_type_id
    WHERE mm.party_id=s.party_id AND mm.status_code='ACTIVE'
      AND (mm.valid_from IS NULL OR mm.valid_from<=CURRENT_DATE) AND (mm.valid_to IS NULL OR mm.valid_to>=CURRENT_DATE)
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('code',pf.fingerprint_code,'titleAr',pf.title_ar,'titleEn',pf.title_en,
      'taxonomyNodeCode',tn.node_code,'taxonomyNameAr',tn.name_ar,'taxonomyNameEn',tn.name_en,
      'experienceLevelCode',pf.experience_level_code,'expertRoleCode',pf.expert_role_code) ORDER BY pf.fingerprint_code) AS items
    FROM professional.professional_fingerprints pf
    JOIN taxonomy.taxonomy_nodes tn ON tn.taxonomy_node_id=pf.primary_taxonomy_node_id
    JOIN taxonomy.taxonomy_versions tv ON tv.taxonomy_version_id=tn.taxonomy_version_id
    WHERE pf.professional_profile_id=s.professional_profile_id AND pf.status_code='ACTIVE'
      AND tn.status_code='ACTIVE' AND tv.status_code='PUBLISHED'
  ) f ON true
  ORDER BY coalesce(s.display_name_ar,s.display_name_en,s.current_job_title_ar,s.party_id::text),s.party_id
  LIMIT LEAST(GREATEST(p_limit,1),50) OFFSET GREATEST(p_offset,0);
$$;

INSERT INTO integration.schema_migrations(migration_name)
VALUES ('0650_v113_backend_public_professional_search')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
