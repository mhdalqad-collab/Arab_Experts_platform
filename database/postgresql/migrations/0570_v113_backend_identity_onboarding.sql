BEGIN;

CREATE OR REPLACE FUNCTION governance.append_audit_event(
  p_domain_code varchar,
  p_action_code varchar,
  p_actor_party_id uuid,
  p_actor_user_account_id uuid,
  p_actor_role_code varchar,
  p_resource_type varchar,
  p_resource_id uuid,
  p_correlation_id varchar,
  p_outcome_code varchar,
  p_risk_level_code varchar,
  p_reason_code varchar,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, governance
AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_occurred_at timestamptz := clock_timestamp();
  v_previous_hash char(64);
  v_event_hash char(64);
BEGIN
  IF p_outcome_code NOT IN ('SUCCESS', 'FAILURE', 'DENIED', 'PARTIAL') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid audit outcome';
  END IF;
  IF p_risk_level_code NOT IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid audit risk level';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('governance.audit_events.hash_chain'));
  SELECT event_hash INTO v_previous_hash
  FROM governance.audit_events
  ORDER BY event_sequence DESC
  LIMIT 1;

  v_event_hash := encode(digest(concat_ws('|',
    v_event_id::text, v_occurred_at::text, p_domain_code, p_action_code,
    coalesce(p_actor_party_id::text, ''), coalesce(p_resource_id::text, ''),
    p_outcome_code, coalesce(p_correlation_id, ''), coalesce(v_previous_hash, ''),
    coalesce(p_details, '{}'::jsonb)::text
  ), 'sha256'), 'hex');

  INSERT INTO governance.audit_events (
    audit_event_id, occurred_at, domain_code, action_code,
    actor_party_id, actor_user_account_id, actor_role_code,
    resource_type, resource_id, correlation_id,
    outcome_code, risk_level_code, reason_code, details,
    previous_event_hash, event_hash
  ) VALUES (
    v_event_id, v_occurred_at, p_domain_code, p_action_code,
    p_actor_party_id, p_actor_user_account_id, p_actor_role_code,
    p_resource_type, p_resource_id, p_correlation_id,
    p_outcome_code, p_risk_level_code, p_reason_code, coalesce(p_details, '{}'::jsonb),
    v_previous_hash, v_event_hash
  );
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION iam.register_external_person(
  p_provider_code varchar,
  p_external_subject text,
  p_email text,
  p_email_verified boolean,
  p_first_name_ar varchar,
  p_last_name_ar varchar,
  p_display_name_ar varchar,
  p_display_name_en varchar DEFAULT NULL,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS TABLE(user_account_id uuid, party_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, core, iam, governance
AS $$
DECLARE
  v_party_id uuid := gen_random_uuid();
  v_account_id uuid := gen_random_uuid();
  v_role_id uuid;
BEGIN
  IF NOT p_email_verified THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Verified email is required';
  END IF;
  IF nullif(btrim(p_provider_code), '') IS NULL OR length(p_provider_code) > 60
     OR nullif(btrim(p_external_subject), '') IS NULL OR length(p_external_subject) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Valid external identity is required';
  END IF;
  IF p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR length(p_email) > 320 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Valid email is required';
  END IF;
  IF nullif(btrim(p_first_name_ar), '') IS NULL OR length(p_first_name_ar) > 100
     OR nullif(btrim(p_last_name_ar), '') IS NULL OR length(p_last_name_ar) > 100
     OR nullif(btrim(p_display_name_ar), '') IS NULL OR length(p_display_name_ar) > 240 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Valid Arabic person names are required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM iam.account_credentials
    WHERE credential_type_code = 'EXTERNAL_IDP'
      AND external_provider_code = p_provider_code
      AND external_subject = p_external_subject
      AND is_active
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'External identity is already linked';
  END IF;
  IF EXISTS (SELECT 1 FROM iam.user_accounts WHERE primary_email = lower(p_email)) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Email is already registered';
  END IF;

  SELECT role_id INTO v_role_id
  FROM governance.roles
  WHERE role_code = 'MEMBER_SELF' AND status_code = 'ACTIVE';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'MEMBER_SELF role seed is required';
  END IF;

  INSERT INTO core.parties (
    party_id, party_type_code, display_name_ar, display_name_en, status_code
  ) VALUES (
    v_party_id, 'PERSON', btrim(p_display_name_ar), nullif(btrim(p_display_name_en), ''), 'ACTIVE'
  );

  INSERT INTO core.persons (party_id, first_name_ar, last_name_ar)
  VALUES (v_party_id, btrim(p_first_name_ar), btrim(p_last_name_ar));

  INSERT INTO iam.user_accounts (
    user_account_id, party_id, primary_email, status_code, email_verified_at, last_login_at
  ) VALUES (
    v_account_id, v_party_id, lower(p_email), 'ACTIVE', clock_timestamp(), clock_timestamp()
  );

  INSERT INTO iam.account_credentials (
    user_account_id, credential_type_code, external_provider_code, external_subject
  ) VALUES (
    v_account_id, 'EXTERNAL_IDP', btrim(p_provider_code), p_external_subject
  );

  INSERT INTO governance.user_role_assignments (
    user_account_id, role_id, status_code, valid_from,
    assigned_by_party_id, assignment_reason
  ) VALUES (
    v_account_id, v_role_id, 'ACTIVE', clock_timestamp(),
    v_party_id, 'SELF_REGISTRATION_VERIFIED_OIDC'
  );

  PERFORM governance.append_audit_event(
    'IAM', 'EXTERNAL_PERSON_REGISTERED', v_party_id, v_account_id, 'MEMBER_SELF',
    'user_account', v_account_id, p_correlation_id,
    'SUCCESS', 'NORMAL', 'VERIFIED_OIDC_REGISTRATION',
    jsonb_build_object('provider_code', p_provider_code, 'email_verified', true)
  );

  RETURN QUERY SELECT v_account_id, v_party_id;
END;
$$;

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0570_v113_backend_identity_onboarding')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
