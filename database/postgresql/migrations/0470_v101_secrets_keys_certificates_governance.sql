BEGIN;

-- Metadata-only governance. Secret values, private keys, and certificate
-- private material must remain in an approved external vault or KMS.

CREATE TABLE governance.security_secret_policies (
  security_secret_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  secret_type_code varchar(24) NOT NULL
    CHECK (secret_type_code IN ('PASSWORD','API_TOKEN','DATABASE_CREDENTIAL','SIGNING_KEY','ENCRYPTION_KEY','TLS_CERTIFICATE','SSH_KEY','WEBHOOK_SECRET')),
  maximum_age_days integer NOT NULL CHECK (maximum_age_days > 0),
  warning_days integer NOT NULL CHECK (warning_days > 0 AND warning_days < maximum_age_days),
  minimum_rotation_approvals smallint NOT NULL DEFAULT 1 CHECK (minimum_rotation_approvals > 0),
  emergency_rotation_hours integer NOT NULL CHECK (emergency_rotation_hours > 0),
  approved_provider_codes jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(approved_provider_codes) = 'array'),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.security_secret_records (
  security_secret_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_code varchar(80) NOT NULL UNIQUE,
  security_secret_policy_id uuid NOT NULL
    REFERENCES governance.security_secret_policies(security_secret_policy_id) ON DELETE RESTRICT,
  security_asset_id uuid NOT NULL
    REFERENCES governance.security_assets(security_asset_id) ON DELETE RESTRICT,
  vault_provider_code varchar(40) NOT NULL,
  vault_reference text NOT NULL,
  version_reference varchar(120) NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  custodian_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_rotated_at timestamptz NOT NULL,
  next_rotation_due_at timestamptz NOT NULL,
  expires_at timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('PENDING','ACTIVE','ROTATION_DUE','COMPROMISED','REVOKED','EXPIRED','RETIRED')),
  checksum_hash char(64) NOT NULL,
  CHECK (owner_party_id <> custodian_party_id),
  CHECK (next_rotation_due_at > last_rotated_at),
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (vault_reference !~* '(password|secret|token|private[_ -]?key)\s*[:=]')
);

CREATE TABLE governance.security_secret_bindings (
  security_secret_binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_secret_record_id uuid NOT NULL
    REFERENCES governance.security_secret_records(security_secret_record_id) ON DELETE RESTRICT,
  consumer_security_asset_id uuid NOT NULL
    REFERENCES governance.security_assets(security_asset_id) ON DELETE RESTRICT,
  usage_purpose varchar(200) NOT NULL,
  environment_code varchar(16) NOT NULL
    CHECK (environment_code IN ('PRODUCTION','STAGING','TEST','DEVELOPMENT','CORPORATE')),
  access_mode_code varchar(20) NOT NULL
    CHECK (access_mode_code IN ('RUNTIME_INJECTION','BROKERED_ACCESS','SIGNED_REQUEST','ENVELOPE_ENCRYPTION')),
  least_privilege_verified boolean NOT NULL DEFAULT false,
  verified_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  verified_at timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (security_secret_record_id, consumer_security_asset_id, environment_code, usage_purpose),
  CHECK (NOT least_privilege_verified OR (verified_by_party_id IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE TABLE governance.security_secret_rotation_events (
  security_secret_rotation_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_secret_record_id uuid NOT NULL
    REFERENCES governance.security_secret_records(security_secret_record_id) ON DELETE RESTRICT,
  rotation_type_code varchar(20) NOT NULL
    CHECK (rotation_type_code IN ('SCHEDULED','EMERGENCY','COMPROMISE_RESPONSE','PROVIDER_MIGRATION')),
  approval_request_id uuid NOT NULL
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  previous_version_reference varchar(120) NOT NULL,
  new_version_reference varchar(120) NOT NULL,
  executed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  executed_at timestamptz NOT NULL,
  verified_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL,
  dependent_assets_verified boolean NOT NULL DEFAULT false,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  outcome_code varchar(16) NOT NULL
    CHECK (outcome_code IN ('SUCCEEDED','PARTIAL','FAILED','ROLLED_BACK')),
  CHECK (new_version_reference <> previous_version_reference),
  CHECK (verified_at >= executed_at),
  CHECK (verified_by_party_id <> executed_by_party_id),
  CHECK (outcome_code <> 'SUCCEEDED' OR (dependent_assets_verified AND evidence_refs <> '[]'::jsonb))
);

CREATE TABLE governance.security_certificate_inventory (
  security_certificate_inventory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_code varchar(80) NOT NULL UNIQUE,
  security_secret_record_id uuid NOT NULL UNIQUE
    REFERENCES governance.security_secret_records(security_secret_record_id) ON DELETE RESTRICT,
  common_name varchar(240) NOT NULL,
  subject_alternative_names jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(subject_alternative_names) = 'array'),
  issuer_name varchar(240) NOT NULL,
  serial_number varchar(160) NOT NULL,
  fingerprint_sha256 char(64) NOT NULL UNIQUE,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  auto_renewal_enabled boolean NOT NULL DEFAULT false,
  renewal_owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  revocation_status_code varchar(16) NOT NULL DEFAULT 'VALID'
    CHECK (revocation_status_code IN ('VALID','REVOKED','UNKNOWN','EXPIRED')),
  last_validated_at timestamptz NOT NULL,
  CHECK (valid_to > valid_from),
  CHECK (last_validated_at >= valid_from)
);

CREATE VIEW governance.v_security_secret_posture AS
SELECT
  s.security_secret_record_id,
  s.secret_code,
  s.security_asset_id,
  p.secret_type_code,
  s.status_code,
  s.next_rotation_due_at,
  s.expires_at,
  CASE
    WHEN s.status_code = 'COMPROMISED' THEN 'EMERGENCY_ROTATION_REQUIRED'
    WHEN s.status_code IN ('REVOKED','EXPIRED','RETIRED') THEN 'NOT_ACTIVE'
    WHEN s.expires_at IS NOT NULL AND s.expires_at <= clock_timestamp() THEN 'EXPIRED'
    WHEN s.next_rotation_due_at <= clock_timestamp() THEN 'ROTATION_OVERDUE'
    WHEN s.next_rotation_due_at <= clock_timestamp() + make_interval(days => p.warning_days) THEN 'ROTATION_DUE_SOON'
    WHEN EXISTS (
      SELECT 1 FROM governance.security_secret_bindings b
      WHERE b.security_secret_record_id = s.security_secret_record_id
        AND b.valid_to IS NULL AND NOT b.least_privilege_verified
    ) THEN 'BINDING_REVIEW_REQUIRED'
    ELSE 'GOVERNED'
  END AS posture_code
FROM governance.security_secret_records s
JOIN governance.security_secret_policies p
  ON p.security_secret_policy_id = s.security_secret_policy_id;

COMMIT;
