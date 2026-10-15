BEGIN;

CREATE TABLE crm.client_accounts (
  client_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_party_id uuid NOT NULL UNIQUE REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL UNIQUE
    REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  client_type_code varchar(60) NOT NULL REFERENCES reference.client_types(client_type_code),
  registration_purpose_code varchar(70) NOT NULL
    REFERENCES reference.client_registration_purposes(registration_purpose_code),
  account_number varchar(40) NOT NULL UNIQUE,
  status_code varchar(30) NOT NULL DEFAULT 'PROSPECT'
    CHECK (status_code IN (
      'PROSPECT', 'ACTIVE', 'DORMANT', 'RESTRICTED', 'SUSPENDED', 'CLOSED'
    )),
  preferred_language_code varchar(12) REFERENCES reference.languages(language_code),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE crm.client_organizations (
  client_organization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL UNIQUE
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  organization_party_id uuid NOT NULL UNIQUE
    REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  procurement_reference varchar(120),
  tax_registration_number varchar(120),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE crm.client_contacts (
  client_contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  person_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  contact_role_code varchar(50) NOT NULL,
  job_title_ar varchar(180),
  is_authorized_representative boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_client_contact_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (client_account_id, person_party_id, contact_role_code, valid_from)
);

CREATE UNIQUE INDEX uq_primary_client_contact
  ON crm.client_contacts(client_account_id)
  WHERE is_primary AND valid_to IS NULL;

CREATE TABLE crm.client_preferences (
  client_preference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  preferred_contact_method_code varchar(40)
    REFERENCES reference.contact_method_types(contact_method_type_code),
  preferred_contact_time varchar(120),
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  service_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (client_account_id)
);

CREATE TABLE crm.client_interactions (
  client_interaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  interaction_type_code varchar(40) NOT NULL,
  channel_code varchar(40) NOT NULL,
  subject_ar varchar(260) NOT NULL,
  summary_ar text,
  occurred_at timestamptz NOT NULL,
  handled_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  related_entity_type varchar(80),
  related_entity_id uuid,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE crm.client_notes (
  client_note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  note_text text NOT NULL,
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  author_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);

CREATE TABLE crm.client_segments (
  client_segment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_code varchar(50) NOT NULL UNIQUE,
  name_ar varchar(160) NOT NULL,
  name_en varchar(160) NOT NULL,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE crm.client_segment_assignments (
  client_segment_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  client_segment_id uuid NOT NULL
    REFERENCES crm.client_segments(client_segment_id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  assigned_by_party_id uuid REFERENCES core.parties(party_id),
  valid_to timestamptz,
  UNIQUE (client_account_id, client_segment_id, assigned_at)
);

CREATE TABLE crm.client_relationship_owners (
  client_relationship_owner_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  owner_party_id uuid NOT NULL REFERENCES core.persons(party_id),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  assigned_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  CONSTRAINT ck_relationship_owner_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (client_account_id, owner_party_id, valid_from)
);

CREATE UNIQUE INDEX uq_active_relationship_owner
  ON crm.client_relationship_owners(client_account_id)
  WHERE valid_to IS NULL;

CREATE TABLE crm.client_documents (
  client_document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  document_type_code varchar(60) NOT NULL
    REFERENCES reference.document_types(document_type_code),
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_client_document_period CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  UNIQUE (client_account_id, file_id)
);

CREATE TABLE crm.client_billing_profiles (
  client_billing_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL UNIQUE
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  billing_name_ar varchar(260) NOT NULL,
  billing_email citext NOT NULL,
  billing_address_id uuid REFERENCES core.addresses(address_id),
  tax_registration_number varchar(120),
  preferred_currency_code char(3) NOT NULL
    REFERENCES reference.currencies(currency_code),
  purchase_order_required boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE crm.client_risk_profiles (
  client_risk_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE CASCADE,
  risk_level_code varchar(20) NOT NULL
    CHECK (risk_level_code IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  credit_status_code varchar(30),
  assessment_notes text,
  assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_until date,
  is_current boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX uq_current_client_risk_profile
  ON crm.client_risk_profiles(client_account_id)
  WHERE is_current;

CREATE TABLE crm.client_status_history (
  client_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE RESTRICT,
  from_status_code varchar(30),
  to_status_code varchar(30) NOT NULL,
  reason_code varchar(50),
  comment text,
  changed_by_party_id uuid REFERENCES core.parties(party_id),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_client_accounts_type_status
  ON crm.client_accounts(client_type_code, status_code);
CREATE INDEX idx_client_interactions_history
  ON crm.client_interactions(client_account_id, occurred_at DESC);
CREATE INDEX idx_client_interactions_next_action
  ON crm.client_interactions(next_action_at)
  WHERE next_action_at IS NOT NULL;
CREATE INDEX idx_client_notes_account
  ON crm.client_notes(client_account_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE TRIGGER trg_client_accounts_updated_at
BEFORE UPDATE ON crm.client_accounts
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_client_account_membership
BEFORE INSERT OR UPDATE OF membership_id, client_party_id
ON crm.client_accounts
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'membership_id',
  'client_party_id',
  'CLIENT'
);
CREATE TRIGGER trg_client_accounts_controlled_status
BEFORE UPDATE OF status_code ON crm.client_accounts
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_client_preferences_updated_at
BEFORE UPDATE ON crm.client_preferences
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_client_billing_profiles_updated_at
BEFORE UPDATE ON crm.client_billing_profiles
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0100_crm')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
