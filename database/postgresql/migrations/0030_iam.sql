BEGIN;

CREATE TABLE iam.user_accounts (
  user_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL UNIQUE
    REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  primary_email citext NOT NULL UNIQUE,
  status_code varchar(30) NOT NULL DEFAULT 'PENDING_VERIFICATION'
    CHECK (status_code IN (
      'PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'SUSPENDED',
      'RECOVERY_PENDING', 'DEACTIVATED', 'CLOSED'
    )),
  email_verified_at timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deactivated_at timestamptz,
  closed_at timestamptz,
  CONSTRAINT ck_account_email_verification
    CHECK (
      status_code = 'PENDING_VERIFICATION'
      OR email_verified_at IS NOT NULL
      OR status_code = 'CLOSED'
    )
);

CREATE TABLE iam.account_credentials (
  credential_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE CASCADE,
  credential_type_code varchar(30) NOT NULL
    CHECK (credential_type_code IN ('PASSWORD', 'PASSKEY', 'EXTERNAL_IDP')),
  password_hash text,
  password_algorithm varchar(40),
  external_provider_code varchar(60),
  external_subject text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT ck_credential_payload CHECK (
    (credential_type_code = 'PASSWORD' AND password_hash IS NOT NULL)
    OR
    (credential_type_code = 'PASSKEY')
    OR
    (credential_type_code = 'EXTERNAL_IDP'
      AND external_provider_code IS NOT NULL
      AND external_subject IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_active_password_credential
  ON iam.account_credentials(user_account_id)
  WHERE credential_type_code = 'PASSWORD' AND is_active;

CREATE UNIQUE INDEX uq_external_identity
  ON iam.account_credentials(external_provider_code, external_subject)
  WHERE credential_type_code = 'EXTERNAL_IDP' AND is_active;

CREATE TABLE iam.email_verifications (
  email_verification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE CASCADE,
  email_address citext NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_email_verification_expiry CHECK (expires_at > created_at)
);

CREATE TABLE iam.authentication_attempts (
  authentication_attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid REFERENCES iam.user_accounts(user_account_id),
  supplied_identifier_hash char(64) NOT NULL,
  result_code varchar(30) NOT NULL,
  failure_reason_code varchar(50),
  ip_address inet,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE iam.user_sessions (
  user_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE CASCADE,
  refresh_token_hash char(64) NOT NULL UNIQUE,
  device_name varchar(160),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason_code varchar(40),
  CONSTRAINT ck_user_session_expiry CHECK (expires_at > created_at)
);

CREATE TABLE iam.account_recovery_requests (
  recovery_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid
    REFERENCES iam.user_accounts(user_account_id) ON DELETE CASCADE,
  requested_identifier_hash char(64) NOT NULL,
  recovery_token_hash char(64) NOT NULL UNIQUE,
  status_code varchar(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status_code IN ('PENDING', 'VERIFIED', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  completed_at timestamptz,
  requested_ip_address inet,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_recovery_expiry CHECK (expires_at > created_at)
);

CREATE TABLE iam.multi_factor_methods (
  multi_factor_method_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE CASCADE,
  method_type_code varchar(30) NOT NULL
    CHECK (method_type_code IN ('TOTP', 'EMAIL_OTP', 'SMS_OTP', 'PASSKEY', 'RECOVERY_CODE')),
  secret_ciphertext text,
  destination_masked varchar(160),
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX uq_primary_active_mfa
  ON iam.multi_factor_methods(user_account_id)
  WHERE is_primary AND revoked_at IS NULL;

CREATE TABLE iam.account_status_history (
  account_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
  from_status_code varchar(30),
  to_status_code varchar(30) NOT NULL,
  reason_code varchar(50),
  comment text,
  changed_by_party_id uuid REFERENCES core.parties(party_id),
  is_automatic boolean NOT NULL DEFAULT false,
  request_id varchar(100),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_auth_attempts_account_time
  ON iam.authentication_attempts(user_account_id, occurred_at DESC);
CREATE INDEX idx_auth_attempts_identifier_time
  ON iam.authentication_attempts(supplied_identifier_hash, occurred_at DESC);
CREATE INDEX idx_sessions_account_active
  ON iam.user_sessions(user_account_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_recovery_pending
  ON iam.account_recovery_requests(expires_at)
  WHERE status_code = 'PENDING';

CREATE TRIGGER trg_user_accounts_updated_at
BEFORE UPDATE ON iam.user_accounts
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TRIGGER trg_user_accounts_controlled_status
BEFORE UPDATE OF status_code ON iam.user_accounts
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0030_iam')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
