BEGIN;

CREATE OR REPLACE FUNCTION governance.set_self_field_privacy(
  p_owner_party_id uuid,p_user_account_id uuid,p_resource_type varchar,p_resource_id uuid,
  p_field_path varchar,p_visibility_code varchar,p_allowed_role_codes jsonb,p_reason text,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,core,evidence,governance AS $$
DECLARE v_id uuid:=gen_random_uuid();v_type varchar(80):=upper(btrim(p_resource_type));v_field varchar(240):=lower(btrim(p_field_path));
BEGIN
  IF v_type NOT IN('PARTY_PROFILE','EVIDENCE_ITEM','FILE') OR v_field !~ '^[a-z][a-z0-9_\.]{0,119}$' OR upper(p_visibility_code) NOT IN('PUBLIC','MEMBERS','AUTHORIZED','PLATFORM_ADMIN','PRIVATE') OR jsonb_typeof(coalesce(p_allowed_role_codes,'[]'::jsonb))<>'array' OR length(coalesce(p_reason,''))>1000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid privacy preference'; END IF;
  IF (v_type='PARTY_PROFILE' AND p_resource_id<>p_owner_party_id)
     OR (v_type='EVIDENCE_ITEM' AND NOT EXISTS(SELECT 1 FROM evidence.evidence_items WHERE evidence_item_id=p_resource_id AND owner_party_id=p_owner_party_id))
     OR (v_type='FILE' AND NOT EXISTS(SELECT 1 FROM core.files WHERE file_id=p_resource_id AND uploaded_by_party_id=p_owner_party_id AND archived_at IS NULL)) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Owned privacy resource not found'; END IF;
  UPDATE governance.field_privacy_preferences SET valid_to=clock_timestamp() WHERE owner_party_id=p_owner_party_id AND resource_type=v_type AND resource_id=p_resource_id AND field_path=v_field AND valid_to IS NULL;
  INSERT INTO governance.field_privacy_preferences(field_privacy_preference_id,owner_party_id,resource_type,resource_id,field_path,visibility_code,allowed_role_codes,changed_by_party_id,change_reason)
  VALUES(v_id,p_owner_party_id,v_type,p_resource_id,v_field,upper(p_visibility_code),coalesce(p_allowed_role_codes,'[]'::jsonb),p_owner_party_id,nullif(btrim(p_reason),''));
  PERFORM governance.append_audit_event('PRIVACY','FIELD_PRIVACY_CHANGED',p_owner_party_id,p_user_account_id,'MEMBER_SELF',lower(v_type),p_resource_id,p_correlation_id,'SUCCESS','HIGH',upper(p_visibility_code),jsonb_build_object('field_path',v_field,'preference_id',v_id));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION core.revoke_self_file_access_grant(
  p_grant_id uuid,p_owner_party_id uuid,p_user_account_id uuid,p_reason text,p_correlation_id varchar DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,core,governance AS $$
DECLARE v_file_id uuid;
BEGIN
  IF nullif(btrim(p_reason),'') IS NULL OR length(p_reason)>1000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revocation reason is required'; END IF;
  UPDATE core.file_access_grants SET revoked_at=clock_timestamp(),revoke_reason=btrim(p_reason) WHERE file_access_grant_id=p_grant_id AND owner_party_id=p_owner_party_id AND revoked_at IS NULL RETURNING file_id INTO v_file_id;
  IF v_file_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Active owned grant not found'; END IF;
  PERFORM governance.append_audit_event('FILES','FILE_ACCESS_REVOKED',p_owner_party_id,p_user_account_id,'MEMBER_SELF','file',v_file_id,p_correlation_id,'SUCCESS','HIGH','OWNER_REVOKED',jsonb_build_object('grant_id',p_grant_id,'reason',btrim(p_reason)));
  RETURN p_grant_id;
END; $$;

CREATE OR REPLACE FUNCTION governance.public_party_projection(p_party_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,core,membership,evidence,governance AS $$
  SELECT CASE WHEN p.party_id IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
    'partyId',p.party_id,
    'displayNameAr',CASE WHEN EXISTS(SELECT 1 FROM governance.field_privacy_preferences x WHERE x.owner_party_id=p.party_id AND x.resource_type='PARTY_PROFILE' AND x.resource_id=p.party_id AND x.field_path='display_name_ar' AND x.visibility_code='PUBLIC' AND x.valid_to IS NULL) THEN p.display_name_ar END,
    'displayNameEn',CASE WHEN EXISTS(SELECT 1 FROM governance.field_privacy_preferences x WHERE x.owner_party_id=p.party_id AND x.resource_type='PARTY_PROFILE' AND x.resource_id=p.party_id AND x.field_path='display_name_en' AND x.visibility_code='PUBLIC' AND x.valid_to IS NULL) THEN p.display_name_en END,
    'verifiedEvidence',coalesce((SELECT jsonb_agg(jsonb_build_object('evidenceItemId',e.evidence_item_id,'evidenceTypeCode',e.evidence_type_code,'titleAr',e.title_ar,'titleEn',e.title_en) ORDER BY e.created_at DESC) FROM evidence.evidence_items e WHERE e.owner_party_id=p.party_id AND e.status_code='VERIFIED' AND e.confidentiality_level_code='PUBLIC' AND EXISTS(SELECT 1 FROM governance.field_privacy_preferences x WHERE x.owner_party_id=p.party_id AND x.resource_type='EVIDENCE_ITEM' AND x.resource_id=e.evidence_item_id AND x.field_path='summary' AND x.visibility_code='PUBLIC' AND x.valid_to IS NULL)),'[]'::jsonb)
  )) END
  FROM core.parties p WHERE p.party_id=p_party_id AND p.status_code='ACTIVE' AND p.archived_at IS NULL
    AND EXISTS(SELECT 1 FROM membership.memberships m WHERE m.party_id=p.party_id AND m.status_code='ACTIVE');
$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0640_v113_backend_privacy_projection') ON CONFLICT DO NOTHING;
COMMIT;
