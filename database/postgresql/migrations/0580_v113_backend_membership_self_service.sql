BEGIN;

CREATE OR REPLACE FUNCTION membership.create_self_application(
  p_party_id uuid,
  p_user_account_id uuid,
  p_membership_type_code varchar,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, membership, governance
AS $$
DECLARE
  v_type membership.membership_types%ROWTYPE;
  v_application_id uuid := gen_random_uuid();
  v_application_no varchar(40);
BEGIN
  SELECT * INTO v_type
  FROM membership.membership_types
  WHERE membership_type_code = upper(btrim(p_membership_type_code))
    AND is_active AND is_publicly_selectable;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unknown or unavailable membership type';
  END IF;

  v_application_no := 'MA-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(v_application_id::text, '-', ''), 1, 12));
  INSERT INTO membership.membership_applications (
    membership_application_id, party_id, membership_type_id, application_no,
    created_by_party_id, updated_by_party_id
  ) VALUES (
    v_application_id, p_party_id, v_type.membership_type_id, v_application_no,
    p_party_id, p_party_id
  );
  INSERT INTO membership.membership_application_steps (
    membership_application_id, step_code, step_order
  ) VALUES
    (v_application_id, 'PROFILE', 1),
    (v_application_id, 'EVIDENCE', 2),
    (v_application_id, 'DECLARATION', 3);
  INSERT INTO membership.membership_application_status_history (
    membership_application_id, to_status_code, reason_code,
    changed_by_party_id, request_id
  ) VALUES (v_application_id, 'DRAFT', 'SELF_APPLICATION_CREATED', p_party_id, p_correlation_id);
  PERFORM governance.append_audit_event(
    'MEMBERSHIP', 'SELF_APPLICATION_CREATED', p_party_id, p_user_account_id,
    'MEMBER_SELF', 'membership_application', v_application_id, p_correlation_id,
    'SUCCESS', 'NORMAL', 'SELF_SERVICE',
    jsonb_build_object('membership_type_code', v_type.membership_type_code)
  );
  RETURN v_application_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'An open application already exists';
END;
$$;

CREATE OR REPLACE FUNCTION membership.save_self_application_step(
  p_application_id uuid,
  p_party_id uuid,
  p_user_account_id uuid,
  p_step_code varchar,
  p_payload jsonb,
  p_complete boolean,
  p_expected_row_version bigint,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, membership, governance
AS $$
DECLARE
  v_application membership.membership_applications%ROWTYPE;
  v_complete_count integer;
  v_step_count integer;
  v_percentage numeric(5,2);
  v_new_status varchar(30);
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 32768 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Step payload must be an object up to 32KB';
  END IF;
  SELECT * INTO v_application FROM membership.membership_applications
  WHERE membership_application_id = p_application_id AND party_id = p_party_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Application not found'; END IF;
  IF v_application.status_code NOT IN ('DRAFT', 'INCOMPLETE', 'READY_TO_SUBMIT', 'MORE_INFO_REQUIRED') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Application cannot be edited in its current state';
  END IF;
  IF v_application.row_version <> p_expected_row_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Application was modified by another request';
  END IF;
  UPDATE membership.membership_application_steps
  SET draft_payload = p_payload,
      status_code = CASE WHEN p_complete THEN 'COMPLETE' ELSE 'IN_PROGRESS' END,
      completeness_percentage = CASE WHEN p_complete THEN 100 ELSE 50 END,
      first_started_at = coalesce(first_started_at, clock_timestamp()),
      completed_at = CASE WHEN p_complete THEN clock_timestamp() ELSE NULL END
  WHERE membership_application_id = p_application_id
    AND step_code = upper(btrim(p_step_code));
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unknown application step'; END IF;

  SELECT count(*) FILTER (WHERE status_code = 'COMPLETE'), count(*),
         round(avg(completeness_percentage), 2)
  INTO v_complete_count, v_step_count, v_percentage
  FROM membership.membership_application_steps
  WHERE membership_application_id = p_application_id;
  v_new_status := CASE WHEN v_step_count > 0 AND v_complete_count = v_step_count THEN 'READY_TO_SUBMIT' ELSE 'INCOMPLETE' END;
  PERFORM set_config('eim.transition_context', 'allowed', true);
  UPDATE membership.membership_applications
  SET status_code = v_new_status, completeness_percentage = v_percentage,
      updated_by_party_id = p_party_id
  WHERE membership_application_id = p_application_id;
  IF v_new_status IS DISTINCT FROM v_application.status_code THEN
    INSERT INTO membership.membership_application_status_history (
      membership_application_id, from_status_code, to_status_code, reason_code,
      changed_by_party_id, request_id
    ) VALUES (
      p_application_id, v_application.status_code, v_new_status,
      'SELF_STEP_COMPLETENESS_CHANGED', p_party_id, p_correlation_id
    );
  END IF;
  PERFORM governance.append_audit_event(
    'MEMBERSHIP', 'SELF_APPLICATION_STEP_SAVED', p_party_id, p_user_account_id,
    'MEMBER_SELF', 'membership_application', p_application_id, p_correlation_id,
    'SUCCESS', 'LOW', upper(btrim(p_step_code)), jsonb_build_object('complete', p_complete)
  );
  RETURN v_application.row_version + 1;
END;
$$;

CREATE OR REPLACE FUNCTION membership.submit_self_application(
  p_application_id uuid,
  p_party_id uuid,
  p_user_account_id uuid,
  p_expected_row_version bigint,
  p_correlation_id varchar DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, membership, governance
AS $$
DECLARE v_application membership.membership_applications%ROWTYPE;
BEGIN
  SELECT * INTO v_application FROM membership.membership_applications
  WHERE membership_application_id = p_application_id AND party_id = p_party_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Application not found'; END IF;
  IF v_application.row_version <> p_expected_row_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Application was modified by another request';
  END IF;
  IF v_application.status_code <> 'READY_TO_SUBMIT' OR v_application.completeness_percentage <> 100 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Application is not complete';
  END IF;
  PERFORM set_config('eim.transition_context', 'allowed', true);
  UPDATE membership.membership_applications
  SET status_code = 'SUBMITTED', submitted_at = clock_timestamp(), updated_by_party_id = p_party_id
  WHERE membership_application_id = p_application_id;
  INSERT INTO membership.membership_application_status_history (
    membership_application_id, from_status_code, to_status_code, reason_code,
    changed_by_party_id, request_id
  ) VALUES (p_application_id, 'READY_TO_SUBMIT', 'SUBMITTED', 'SELF_SUBMITTED', p_party_id, p_correlation_id);
  PERFORM governance.append_audit_event(
    'MEMBERSHIP', 'SELF_APPLICATION_SUBMITTED', p_party_id, p_user_account_id,
    'MEMBER_SELF', 'membership_application', p_application_id, p_correlation_id,
    'SUCCESS', 'NORMAL', 'SELF_SUBMITTED', '{}'::jsonb
  );
  RETURN v_application.row_version + 1;
END;
$$;

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0580_v113_backend_membership_self_service')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
