BEGIN;

-- Operationalizes just-in-time privileged access while preserving the
-- existing RBAC, approval, delegation, and access-review records.

CREATE TABLE governance.privileged_access_requests (
  privileged_access_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code varchar(60) NOT NULL UNIQUE,
  requester_user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
  security_asset_id uuid NOT NULL
    REFERENCES governance.security_assets(security_asset_id) ON DELETE RESTRICT,
  permission_id uuid NOT NULL
    REFERENCES governance.permissions(permission_id) ON DELETE RESTRICT,
  business_reason text NOT NULL,
  requested_start_at timestamptz NOT NULL,
  requested_end_at timestamptz NOT NULL,
  ticket_reference varchar(120) NOT NULL,
  approval_request_id uuid NOT NULL
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status_code IN ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED','FULFILLED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (requested_end_at > requested_start_at)
);

CREATE TABLE governance.privileged_access_grants (
  privileged_access_grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privileged_access_request_id uuid NOT NULL UNIQUE
    REFERENCES governance.privileged_access_requests(privileged_access_request_id) ON DELETE RESTRICT,
  grantee_user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
  granted_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  scope_constraints jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(scope_constraints) = 'object'),
  step_up_verified_at timestamptz NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('SCHEDULED','ACTIVE','SUSPENDED','EXPIRED','REVOKED')),
  revoked_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (valid_to > valid_from),
  CHECK (status_code <> 'REVOKED' OR
    (revoked_by_party_id IS NOT NULL AND revoked_at IS NOT NULL AND revoke_reason IS NOT NULL))
);

CREATE TABLE governance.privileged_access_sessions (
  privileged_access_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privileged_access_grant_id uuid NOT NULL
    REFERENCES governance.privileged_access_grants(privileged_access_grant_id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  source_ip inet NOT NULL,
  device_fingerprint_hash char(64) NOT NULL,
  purpose_confirmation text NOT NULL,
  recording_reference text,
  command_log_hash char(64),
  termination_code varchar(24)
    CHECK (termination_code IN ('NORMAL','TIMEOUT','REVOKED','POLICY_VIOLATION','EMERGENCY_STOP')),
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('ACTIVE','ENDED','TERMINATED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK (status_code = 'ACTIVE' OR
    (ended_at IS NOT NULL AND termination_code IS NOT NULL AND command_log_hash IS NOT NULL))
);

CREATE TABLE governance.privileged_access_session_events (
  privileged_access_session_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privileged_access_session_id uuid NOT NULL
    REFERENCES governance.privileged_access_sessions(privileged_access_session_id) ON DELETE RESTRICT,
  event_sequence integer NOT NULL CHECK (event_sequence > 0),
  event_type_code varchar(24) NOT NULL
    CHECK (event_type_code IN ('START','AUTHORIZATION_CHECK','COMMAND_GROUP','DATA_ACCESS','POLICY_ALERT','SUSPEND','RESUME','END')),
  event_summary text NOT NULL,
  event_hash char(64) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  correlation_id uuid NOT NULL,
  UNIQUE (privileged_access_session_id, event_sequence),
  UNIQUE (privileged_access_session_id, event_hash)
);

CREATE TABLE governance.privileged_access_attestations (
  privileged_access_attestation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privileged_access_session_id uuid NOT NULL UNIQUE
    REFERENCES governance.privileged_access_sessions(privileged_access_session_id) ON DELETE RESTRICT,
  reviewed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  outcome_code varchar(24) NOT NULL
    CHECK (outcome_code IN ('COMPLIANT','EXCEPTION_FOUND','INCIDENT_REQUIRED','INCONCLUSIVE')),
  review_notes text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  audit_case_id uuid REFERENCES governance.audit_cases(audit_case_id) ON DELETE RESTRICT,
  CHECK (outcome_code <> 'INCIDENT_REQUIRED' OR audit_case_id IS NOT NULL)
);

CREATE VIEW governance.v_privileged_access_posture AS
SELECT
  g.privileged_access_grant_id,
  r.request_code,
  r.requester_user_account_id,
  r.security_asset_id,
  r.permission_id,
  g.status_code AS grant_status_code,
  g.valid_to,
  CASE
    WHEN r.status_code <> 'APPROVED' AND g.status_code IN ('SCHEDULED','ACTIVE')
      THEN 'APPROVAL_INVALID'
    WHEN g.status_code = 'ACTIVE' AND g.valid_to <= clock_timestamp()
      THEN 'GRANT_EXPIRED'
    WHEN EXISTS (
      SELECT 1 FROM governance.privileged_access_sessions s
      WHERE s.privileged_access_grant_id = g.privileged_access_grant_id
        AND s.status_code = 'ACTIVE' AND g.status_code <> 'ACTIVE'
    ) THEN 'SESSION_TERMINATION_REQUIRED'
    WHEN EXISTS (
      SELECT 1 FROM governance.privileged_access_sessions s
      WHERE s.privileged_access_grant_id = g.privileged_access_grant_id
        AND s.status_code <> 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM governance.privileged_access_attestations a
          WHERE a.privileged_access_session_id = s.privileged_access_session_id
        )
    ) THEN 'ATTESTATION_REQUIRED'
    ELSE 'GOVERNED'
  END AS posture_code
FROM governance.privileged_access_grants g
JOIN governance.privileged_access_requests r
  ON r.privileged_access_request_id = g.privileged_access_request_id;

COMMIT;
