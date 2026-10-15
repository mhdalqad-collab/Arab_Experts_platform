BEGIN;

-- Privacy by field, consent, retention, data-subject rights and immutable audit.

CREATE OR REPLACE FUNCTION governance.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'insufficient_privilege',
    MESSAGE = format('Table %I.%I is append-only.', TG_TABLE_SCHEMA, TG_TABLE_NAME);
END;
$$;

CREATE TABLE governance.data_classifications (
  data_classification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_code varchar(40) NOT NULL UNIQUE,
  name_ar varchar(160) NOT NULL,
  name_en varchar(160) NOT NULL,
  sensitivity_rank smallint NOT NULL UNIQUE CHECK (sensitivity_rank BETWEEN 1 AND 10),
  default_visibility_code varchar(20) NOT NULL
    CHECK (default_visibility_code IN ('PUBLIC', 'MEMBERS', 'RESTRICTED', 'PRIVATE')),
  encryption_required boolean NOT NULL DEFAULT false,
  masking_required boolean NOT NULL DEFAULT false,
  description_ar text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE governance.data_purposes (
  data_purpose_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(220) NOT NULL,
  name_en varchar(220) NOT NULL,
  legal_basis_code varchar(40) NOT NULL
    CHECK (legal_basis_code IN (
      'CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST',
      'PUBLIC_TASK', 'LEGITIMATE_INTEREST'
    )),
  description_ar text NOT NULL,
  is_optional boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.data_field_catalog (
  data_field_catalog_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type varchar(80) NOT NULL,
  field_path varchar(240) NOT NULL,
  label_ar varchar(240) NOT NULL,
  data_classification_id uuid NOT NULL
    REFERENCES governance.data_classifications(data_classification_id) ON DELETE RESTRICT,
  default_purpose_id uuid
    REFERENCES governance.data_purposes(data_purpose_id) ON DELETE RESTRICT,
  is_required boolean NOT NULL DEFAULT false,
  is_public_eligible boolean NOT NULL DEFAULT false,
  is_searchable boolean NOT NULL DEFAULT false,
  retention_policy_code varchar(60),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (resource_type, field_path)
);

CREATE TABLE governance.privacy_notices (
  privacy_notice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(300) NOT NULL,
  audience_code varchar(40) NOT NULL
    CHECK (audience_code IN ('VISITOR', 'MEMBER', 'CLIENT', 'STAFF', 'PARTNER', 'ALL')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'UNDER_REVIEW', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.privacy_notice_versions (
  privacy_notice_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privacy_notice_id uuid NOT NULL
    REFERENCES governance.privacy_notices(privacy_notice_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  content_ar text NOT NULL,
  content_en text,
  purposes_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  approved_by_party_id uuid REFERENCES core.parties(party_id),
  approved_at timestamptz,
  content_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_privacy_notice_period
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  UNIQUE (privacy_notice_id, version_no)
);

CREATE TABLE governance.consent_records (
  consent_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  data_purpose_id uuid NOT NULL
    REFERENCES governance.data_purposes(data_purpose_id) ON DELETE RESTRICT,
  privacy_notice_version_id uuid NOT NULL
    REFERENCES governance.privacy_notice_versions(privacy_notice_version_id) ON DELETE RESTRICT,
  consent_status_code varchar(20) NOT NULL
    CHECK (consent_status_code IN ('GRANTED', 'DENIED', 'WITHDRAWN', 'EXPIRED')),
  collection_channel_code varchar(40) NOT NULL,
  collection_context jsonb,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  expires_at timestamptz,
  evidence_hash char(64) NOT NULL,
  source_ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_consent_dates CHECK (
    (consent_status_code = 'GRANTED' AND granted_at IS NOT NULL)
    OR consent_status_code <> 'GRANTED'
  )
);

CREATE TABLE governance.consent_history (
  consent_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_record_id uuid NOT NULL
    REFERENCES governance.consent_records(consent_record_id) ON DELETE RESTRICT,
  from_status_code varchar(20),
  to_status_code varchar(20) NOT NULL,
  reason text,
  changed_by_party_id uuid REFERENCES core.parties(party_id),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.field_privacy_preferences (
  field_privacy_preference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE CASCADE,
  resource_type varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  field_path varchar(240) NOT NULL,
  visibility_code varchar(20) NOT NULL
    CHECK (visibility_code IN ('PUBLIC', 'MEMBERS', 'AUTHORIZED', 'PLATFORM_ADMIN', 'PRIVATE')),
  allowed_role_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  changed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_field_privacy_period CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX uq_active_field_privacy_preference
  ON governance.field_privacy_preferences(owner_party_id, resource_type, resource_id, field_path)
  WHERE valid_to IS NULL;

CREATE TABLE governance.privacy_access_overrides (
  privacy_access_override_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  subject_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  resource_type varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  field_paths jsonb NOT NULL,
  purpose_code varchar(60) NOT NULL,
  legal_authority_reference varchar(240),
  approval_request_id uuid NOT NULL
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  accessed_at timestamptz,
  access_result_code varchar(20)
    CHECK (access_result_code IN ('GRANTED', 'DENIED', 'USED', 'EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_privacy_override_period CHECK (ends_at > starts_at)
);

CREATE TABLE governance.retention_policies (
  retention_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_policy_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  resource_type varchar(80) NOT NULL,
  trigger_event_code varchar(60) NOT NULL,
  retention_months integer NOT NULL CHECK (retention_months > 0),
  terminal_action_code varchar(30) NOT NULL
    CHECK (terminal_action_code IN ('ARCHIVE', 'ANONYMIZE', 'DELETE', 'REVIEW')),
  legal_basis text NOT NULL,
  exception_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.legal_holds (
  legal_hold_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_code varchar(60) NOT NULL UNIQUE,
  resource_type varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  reason text NOT NULL,
  authority_reference varchar(240),
  starts_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ends_at timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('ACTIVE', 'RELEASED', 'EXPIRED')),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  released_by_party_id uuid REFERENCES core.parties(party_id),
  released_at timestamptz,
  CONSTRAINT ck_legal_hold_period CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE governance.data_subject_requests (
  data_subject_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code varchar(60) NOT NULL UNIQUE,
  subject_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  request_type_code varchar(30) NOT NULL
    CHECK (request_type_code IN (
      'ACCESS', 'EXPORT', 'CORRECTION', 'RESTRICTION',
      'OBJECTION', 'CONSENT_WITHDRAWAL', 'ERASURE'
    )),
  scope_description text NOT NULL,
  identity_verified_at timestamptz,
  status_code varchar(30) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status_code IN (
      'RECEIVED', 'IDENTITY_PENDING', 'ASSESSING', 'IN_PROGRESS',
      'COMPLETED', 'PARTIALLY_COMPLETED', 'REJECTED', 'CANCELLED'
    )),
  assigned_to_party_id uuid REFERENCES core.parties(party_id),
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  decision_reason text,
  response_file_id uuid REFERENCES core.files(file_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.processing_activities (
  processing_activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(300) NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  purpose_ids jsonb NOT NULL,
  data_categories jsonb NOT NULL,
  data_subject_categories jsonb NOT NULL,
  recipient_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  transfer_countries jsonb NOT NULL DEFAULT '[]'::jsonb,
  security_measures text NOT NULL,
  retention_summary text NOT NULL,
  risk_level_code varchar(20) NOT NULL
    CHECK (risk_level_code IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  assessment_required boolean NOT NULL DEFAULT false,
  last_assessed_at timestamptz,
  next_review_date date,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.audit_events (
  audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  domain_code varchar(60) NOT NULL,
  action_code varchar(100) NOT NULL,
  actor_party_id uuid REFERENCES core.parties(party_id) ON DELETE SET NULL,
  actor_user_account_id uuid REFERENCES iam.user_accounts(user_account_id) ON DELETE SET NULL,
  actor_role_code varchar(60),
  resource_type varchar(80) NOT NULL,
  resource_id uuid,
  request_id varchar(120),
  correlation_id varchar(120),
  source_ip inet,
  user_agent text,
  outcome_code varchar(20) NOT NULL
    CHECK (outcome_code IN ('SUCCESS', 'FAILURE', 'DENIED', 'PARTIAL')),
  risk_level_code varchar(20) NOT NULL DEFAULT 'NORMAL'
    CHECK (risk_level_code IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  reason_code varchar(80),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_event_hash char(64),
  event_hash char(64) NOT NULL UNIQUE
);

CREATE TABLE governance.audit_cases (
  audit_case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(320) NOT NULL,
  domain_code varchar(60) NOT NULL,
  risk_level_code varchar(20) NOT NULL
    CHECK (risk_level_code IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  source_audit_event_id uuid
    REFERENCES governance.audit_events(audit_event_id) ON DELETE RESTRICT,
  auditor_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  action_owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  finding text NOT NULL,
  root_cause text,
  target_date date NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status_code IN (
      'OPEN', 'INVESTIGATING', 'ACTION_PLANNED', 'IMPLEMENTING',
      'VERIFYING', 'CLOSED', 'REJECTED'
    )),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz
);

CREATE TABLE governance.corrective_actions (
  corrective_action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_case_id uuid NOT NULL
    REFERENCES governance.audit_cases(audit_case_id) ON DELETE CASCADE,
  action_code varchar(60) NOT NULL,
  description text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  due_date date NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status_code IN ('PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'INEFFECTIVE', 'CANCELLED')),
  effectiveness_notes text,
  verified_by_party_id uuid REFERENCES core.parties(party_id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (audit_case_id, action_code)
);

CREATE TABLE governance.corrective_action_evidence (
  corrective_action_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corrective_action_id uuid NOT NULL
    REFERENCES governance.corrective_actions(corrective_action_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  description text,
  submitted_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (corrective_action_id, file_id)
);

CREATE INDEX idx_consent_party_purpose
  ON governance.consent_records(party_id, data_purpose_id, created_at DESC);
CREATE INDEX idx_field_privacy_resource
  ON governance.field_privacy_preferences(resource_type, resource_id);
CREATE INDEX idx_dsr_status_due
  ON governance.data_subject_requests(status_code, due_at);
CREATE INDEX idx_audit_time_domain
  ON governance.audit_events(occurred_at DESC, domain_code);
CREATE INDEX idx_audit_actor_time
  ON governance.audit_events(actor_party_id, occurred_at DESC);
CREATE INDEX idx_audit_resource
  ON governance.audit_events(resource_type, resource_id, occurred_at DESC);
CREATE INDEX idx_audit_risk
  ON governance.audit_events(risk_level_code, occurred_at DESC)
  WHERE risk_level_code IN ('HIGH', 'CRITICAL');
CREATE INDEX idx_audit_cases_status_due
  ON governance.audit_cases(status_code, target_date);

CREATE TRIGGER trg_audit_events_no_update
BEFORE UPDATE ON governance.audit_events
FOR EACH ROW EXECUTE FUNCTION governance.reject_audit_mutation();
CREATE TRIGGER trg_audit_events_no_delete
BEFORE DELETE ON governance.audit_events
FOR EACH ROW EXECUTE FUNCTION governance.reject_audit_mutation();
CREATE TRIGGER trg_consent_history_no_update
BEFORE UPDATE ON governance.consent_history
FOR EACH ROW EXECUTE FUNCTION governance.reject_audit_mutation();
CREATE TRIGGER trg_consent_history_no_delete
BEFORE DELETE ON governance.consent_history
FOR EACH ROW EXECUTE FUNCTION governance.reject_audit_mutation();
CREATE TRIGGER trg_privacy_notices_updated_at
BEFORE UPDATE ON governance.privacy_notices
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_retention_updated_at
BEFORE UPDATE ON governance.retention_policies
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_dsr_updated_at
BEFORE UPDATE ON governance.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_processing_updated_at
BEFORE UPDATE ON governance.processing_activities
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_audit_cases_updated_at
BEFORE UPDATE ON governance.audit_cases
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_corrective_actions_updated_at
BEFORE UPDATE ON governance.corrective_actions
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0180_privacy_consent_audit')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
