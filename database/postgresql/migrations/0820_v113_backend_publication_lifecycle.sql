BEGIN;
INSERT INTO governance.permissions(permission_code,name_ar,name_en,domain_code,action_code,resource_type,risk_level_code,requires_step_up_auth,requires_reason)
VALUES('professional.publish.lifecycle','إدارة دورة حياة النسخ المنشورة','Manage published profile lifecycle','PROFESSIONAL','PUBLISH_LIFECYCLE','published_profile','CRITICAL',true,true)
ON CONFLICT(permission_code) DO UPDATE SET is_active=true,requires_step_up_auth=true,requires_reason=true;
INSERT INTO governance.role_permissions(role_id,permission_id,constraint_expression)
SELECT r.role_id,p.permission_id,'{"scope":"platform"}'::jsonb FROM governance.roles r CROSS JOIN governance.permissions p WHERE r.role_code='PLATFORM_ADMIN' AND p.permission_code='professional.publish.lifecycle'
ON CONFLICT(role_id,permission_id,valid_from) DO NOTHING;

ALTER TABLE professional.published_profile_materializations
 ADD COLUMN IF NOT EXISTS lifecycle_status_code varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK(lifecycle_status_code IN('ACTIVE','SUSPENDED','REVOKED','SUPERSEDED')),
 ADD COLUMN IF NOT EXISTS lifecycle_reason text,
 ADD COLUMN IF NOT EXISTS lifecycle_changed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS lifecycle_changed_at timestamptz;

CREATE TABLE professional.publication_lifecycle_history(
 publication_lifecycle_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 published_profile_materialization_id uuid NOT NULL REFERENCES professional.published_profile_materializations(published_profile_materialization_id) ON DELETE RESTRICT,
 previous_status_code varchar(20) NOT NULL,
 new_status_code varchar(20) NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 20 AND 2000),
 changed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 correlation_id varchar(120)
);
CREATE INDEX idx_publication_lifecycle_history ON professional.publication_lifecycle_history(published_profile_materialization_id,changed_at);

DROP TRIGGER trg_protect_published_profile_materialization ON professional.published_profile_materializations;
ALTER FUNCTION professional.protect_published_profile_materialization() RENAME TO protect_published_profile_materialization_pre0820;
CREATE OR REPLACE FUNCTION professional.protect_published_profile_materialization() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_controlled boolean:=coalesce(current_setting('eim.publication_lifecycle_context',true),'')='allowed';
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Published materializations are immutable';END IF;
 IF OLD.published_profile_materialization_id<>NEW.published_profile_materialization_id OR OLD.professional_profile_id<>NEW.professional_profile_id OR OLD.profile_publication_request_id<>NEW.profile_publication_request_id OR OLD.consolidated_snapshot_id<>NEW.consolidated_snapshot_id OR OLD.publication_version_no<>NEW.publication_version_no OR OLD.sealed_snapshot<>NEW.sealed_snapshot OR OLD.public_projection<>NEW.public_projection OR OLD.consolidated_integrity_hash_sha256<>NEW.consolidated_integrity_hash_sha256 OR OLD.decision_seal_hash_sha256<>NEW.decision_seal_hash_sha256 OR OLD.decided_by_party_id<>NEW.decided_by_party_id OR OLD.decision_comment<>NEW.decision_comment OR OLD.decided_at<>NEW.decided_at OR OLD.created_at<>NEW.created_at THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Published materialization content is immutable';END IF;
 IF v_controlled THEN
  IF NOT ((OLD.lifecycle_status_code='ACTIVE' AND NEW.lifecycle_status_code IN('SUSPENDED','REVOKED') AND NOT NEW.is_active AND NEW.superseded_at IS NOT NULL) OR (OLD.lifecycle_status_code='SUSPENDED' AND NEW.lifecycle_status_code='ACTIVE' AND NEW.is_active AND NEW.superseded_at IS NULL) OR (OLD.lifecycle_status_code='SUSPENDED' AND NEW.lifecycle_status_code='REVOKED' AND NOT NEW.is_active AND NEW.superseded_at IS NOT NULL)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Invalid controlled publication lifecycle transition';END IF;
 ELSE
  IF NOT (OLD.lifecycle_status_code='ACTIVE' AND OLD.is_active AND NOT NEW.is_active AND NEW.superseded_at IS NOT NULL) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Published materialization mutation is forbidden';END IF;
  NEW.lifecycle_status_code:='SUPERSEDED';NEW.lifecycle_reason:='Superseded by a newer approved publication';NEW.lifecycle_changed_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER trg_protect_published_profile_materialization BEFORE UPDATE OR DELETE ON professional.published_profile_materializations FOR EACH ROW EXECUTE FUNCTION professional.protect_published_profile_materialization();

CREATE OR REPLACE FUNCTION professional.transition_published_profile_lifecycle(p_materialization_id uuid,p_actor_party_id uuid,p_user_account_id uuid,p_action varchar,p_reason text,p_correlation_id varchar DEFAULT NULL) RETURNS varchar
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v professional.published_profile_materializations%ROWTYPE;v_action varchar:=upper(btrim(p_action));v_new varchar;v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO v FROM professional.published_profile_materializations WHERE published_profile_materialization_id=p_materialization_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Published materialization not found';END IF;
 IF v_action NOT IN('SUSPEND','RESTORE','REVOKE') OR nullif(btrim(p_reason),'') IS NULL OR length(btrim(p_reason)) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid lifecycle action and reason required';END IF;
 v_new:=CASE v_action WHEN 'SUSPEND' THEN 'SUSPENDED' WHEN 'RESTORE' THEN 'ACTIVE' ELSE 'REVOKED' END;
 IF NOT ((v.lifecycle_status_code='ACTIVE' AND v_new IN('SUSPENDED','REVOKED')) OR (v.lifecycle_status_code='SUSPENDED' AND v_new IN('ACTIVE','REVOKED'))) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Invalid publication lifecycle transition';END IF;
 PERFORM set_config('eim.publication_lifecycle_context','allowed',true);
 UPDATE professional.published_profile_materializations SET lifecycle_status_code=v_new,lifecycle_reason=btrim(p_reason),lifecycle_changed_by_party_id=p_actor_party_id,lifecycle_changed_at=v_now,is_active=(v_new='ACTIVE'),superseded_at=CASE WHEN v_new='ACTIVE' THEN NULL ELSE v_now END WHERE published_profile_materialization_id=p_materialization_id;
 INSERT INTO professional.publication_lifecycle_history(published_profile_materialization_id,previous_status_code,new_status_code,reason,changed_by_party_id,changed_at,correlation_id) VALUES(p_materialization_id,v.lifecycle_status_code,v_new,btrim(p_reason),p_actor_party_id,v_now,p_correlation_id);
 PERFORM set_config('eim.transition_context','allowed',true);UPDATE professional.professional_profiles SET status_code=CASE v_new WHEN 'ACTIVE' THEN 'PUBLISHED' WHEN 'SUSPENDED' THEN 'HIDDEN' ELSE 'UPDATE_REQUIRED' END WHERE professional_profile_id=v.professional_profile_id;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_'||v_new,p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','published_profile_materialization',p_materialization_id,p_correlation_id,'SUCCESS','CRITICAL',v_new,jsonb_build_object('previous_status',v.lifecycle_status_code,'reason',btrim(p_reason),'publication_request_id',v.profile_publication_request_id));RETURN v_new;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0820_v113_backend_publication_lifecycle') ON CONFLICT DO NOTHING;
COMMIT;
