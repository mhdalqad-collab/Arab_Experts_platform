BEGIN;

-- Package A creates target-domain foundations only. It does not move, rename,
-- update, or delete any existing record.
CREATE SCHEMA IF NOT EXISTS contract;
CREATE SCHEMA IF NOT EXISTS rights;
CREATE SCHEMA IF NOT EXISTS quality;

CREATE TABLE professional.experience_records (
  experience_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_profile_id uuid NOT NULL
    REFERENCES professional.professional_profiles(professional_profile_id) ON DELETE CASCADE,
  experience_type_code varchar(40) NOT NULL,
  title_ar varchar(260) NOT NULL,
  title_en varchar(260),
  organization_party_id uuid REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  country_code char(2) REFERENCES reference.countries(country_code) ON DELETE RESTRICT,
  started_on date,
  ended_on date,
  duration_days integer CHECK (duration_days IS NULL OR duration_days >= 0),
  role_code varchar(40),
  contribution_summary_ar text,
  outcome_summary_ar text,
  legacy_source_table varchar(80),
  legacy_source_id uuid,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_experience_record_period
    CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on),
  CONSTRAINT uq_experience_legacy_source UNIQUE (legacy_source_table, legacy_source_id)
);

CREATE INDEX ix_experience_records_profile_type
  ON professional.experience_records (professional_profile_id, experience_type_code);

CREATE TRIGGER trg_experience_records_updated
BEFORE UPDATE ON professional.experience_records
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE taxonomy.concept_status_history (
  concept_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE CASCADE,
  from_status_code varchar(30),
  to_status_code varchar(30) NOT NULL,
  transition_reason_ar text NOT NULL,
  decided_by_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  correlation_id uuid,
  CONSTRAINT ck_concept_status_changed
    CHECK (from_status_code IS NULL OR from_status_code <> to_status_code)
);

CREATE INDEX ix_concept_status_history_node_time
  ON taxonomy.concept_status_history (taxonomy_node_id, decided_at DESC);

CREATE TABLE taxonomy.mapping_decisions (
  mapping_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_mapping_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_mappings(taxonomy_mapping_id) ON DELETE CASCADE,
  decision_code varchar(20) NOT NULL
    CHECK (decision_code IN ('PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  rationale_ar text NOT NULL,
  evidence_item_id uuid REFERENCES evidence.evidence_items(evidence_item_id) ON DELETE RESTRICT,
  confidence_score numeric(5,4)
    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  decided_by_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ix_mapping_decisions_mapping_time
  ON taxonomy.mapping_decisions (taxonomy_mapping_id, decided_at DESC);

CREATE TABLE contract.contract_amendments (
  contract_amendment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  amendment_number integer NOT NULL CHECK (amendment_number > 0),
  title_ar varchar(260) NOT NULL,
  reason_ar text NOT NULL,
  scope_impact_ar text,
  schedule_impact_days integer,
  amount_impact_minor bigint,
  currency_code char(3) REFERENCES reference.currencies(currency_code) ON DELETE RESTRICT,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
      'SIGNED', 'WITHDRAWN', 'SUPERSEDED'
    )),
  effective_on date,
  approved_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_contract_amendment_approval
    CHECK (
      (status_code NOT IN ('APPROVED', 'SIGNED'))
      OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL)
    ),
  UNIQUE (contract_id, amendment_number)
);

CREATE TRIGGER trg_contract_amendments_updated
BEFORE UPDATE ON contract.contract_amendments
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE contract.contract_amendment_files (
  contract_amendment_file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_amendment_id uuid NOT NULL
    REFERENCES contract.contract_amendments(contract_amendment_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  file_role_code varchar(30) NOT NULL DEFAULT 'SUPPORTING',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (contract_amendment_id, file_id)
);

CREATE TABLE delivery.project_baselines (
  project_baseline_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  scope_summary_ar text NOT NULL,
  planned_start_date date NOT NULL,
  planned_end_date date NOT NULL,
  budget_amount_minor bigint CHECK (budget_amount_minor IS NULL OR budget_amount_minor >= 0),
  currency_code char(3) REFERENCES reference.currencies(currency_code) ON DELETE RESTRICT,
  source_change_request_id uuid
    REFERENCES delivery.change_requests(change_request_id) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  approved_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_project_baseline_period CHECK (planned_end_date >= planned_start_date),
  CONSTRAINT ck_project_baseline_approval
    CHECK (
      status_code <> 'APPROVED'
      OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL)
    ),
  UNIQUE (project_id, version_no)
);

CREATE UNIQUE INDEX uq_current_project_baseline
  ON delivery.project_baselines (project_id)
  WHERE status_code = 'APPROVED';

CREATE TABLE delivery.acceptance_criteria (
  acceptance_criterion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL
    REFERENCES delivery.deliverables(deliverable_id) ON DELETE CASCADE,
  criterion_code varchar(50) NOT NULL,
  description_ar text NOT NULL,
  measurement_method_ar text NOT NULL,
  target_value varchar(240),
  weight_percentage numeric(5,2)
    CHECK (weight_percentage IS NULL OR weight_percentage BETWEEN 0 AND 100),
  is_mandatory boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0),
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (deliverable_id, criterion_code),
  UNIQUE (deliverable_id, display_order)
);

CREATE TABLE delivery.progress_reports (
  progress_report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  report_number integer NOT NULL CHECK (report_number > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  completion_percentage numeric(5,2) NOT NULL
    CHECK (completion_percentage BETWEEN 0 AND 100),
  summary_ar text NOT NULL,
  achievements_ar text,
  next_period_plan_ar text,
  submitted_by_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  client_decision_code varchar(20)
    CHECK (client_decision_code IS NULL OR client_decision_code IN (
      'ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED'
    )),
  client_decided_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  client_decided_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_progress_report_period CHECK (period_end >= period_start),
  CONSTRAINT ck_progress_report_decision
    CHECK (
      client_decision_code IS NULL
      OR (client_decided_by_party_id IS NOT NULL AND client_decided_at IS NOT NULL)
    ),
  UNIQUE (project_id, report_number)
);

CREATE TRIGGER trg_progress_reports_updated
BEFORE UPDATE ON delivery.progress_reports
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE delivery.project_contributions (
  project_contribution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  contributor_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  contribution_role_code varchar(40) NOT NULL,
  responsibility_code varchar(30) NOT NULL,
  contribution_percentage numeric(5,2)
    CHECK (contribution_percentage IS NULL OR contribution_percentage BETWEEN 0 AND 100),
  contribution_summary_ar text NOT NULL,
  evidence_item_id uuid REFERENCES evidence.evidence_items(evidence_item_id) ON DELETE RESTRICT,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (project_id, contributor_party_id, contribution_role_code)
);

CREATE TABLE rights.disclosure_records (
  disclosure_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_asset_id uuid REFERENCES finance.ip_assets(ip_asset_id) ON DELETE RESTRICT,
  file_id uuid REFERENCES core.files(file_id) ON DELETE RESTRICT,
  disclosed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  disclosed_to_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  purpose_code varchar(50) NOT NULL,
  legal_basis_code varchar(50),
  authorization_reference varchar(160) NOT NULL,
  disclosed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_disclosure_subject
    CHECK (ip_asset_id IS NOT NULL OR file_id IS NOT NULL),
  CONSTRAINT ck_disclosure_parties_differ
    CHECK (disclosed_by_party_id <> disclosed_to_party_id),
  CONSTRAINT ck_disclosure_expiry
    CHECK (expires_at IS NULL OR expires_at > disclosed_at),
  CONSTRAINT ck_disclosure_revocation
    CHECK (revoked_at IS NULL OR revoked_at >= disclosed_at)
);

CREATE INDEX ix_disclosure_records_recipient_time
  ON rights.disclosure_records (disclosed_to_party_id, disclosed_at DESC);

CREATE TABLE rights.information_use_restrictions (
  information_use_restriction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_asset_id uuid REFERENCES finance.ip_assets(ip_asset_id) ON DELETE CASCADE,
  file_id uuid REFERENCES core.files(file_id) ON DELETE CASCADE,
  restriction_type_code varchar(40) NOT NULL,
  restriction_text_ar text NOT NULL,
  permitted_purpose_code varchar(50),
  prohibited_action_code varchar(50),
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  imposed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_information_restriction_subject
    CHECK ((ip_asset_id IS NOT NULL)::integer + (file_id IS NOT NULL)::integer = 1),
  CONSTRAINT ck_information_restriction_period
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE finance.ledger_accounts (
  ledger_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(220) NOT NULL,
  account_type_code varchar(30) NOT NULL
    CHECK (account_type_code IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  currency_code char(3) REFERENCES reference.currencies(currency_code) ON DELETE RESTRICT,
  owner_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE finance.ledger_transactions (
  ledger_transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number varchar(60) NOT NULL UNIQUE,
  transaction_type_code varchar(40) NOT NULL,
  source_entity_type varchar(60) NOT NULL,
  source_entity_id uuid NOT NULL,
  description_ar text NOT NULL,
  occurred_at timestamptz NOT NULL,
  posted_at timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'POSTED', 'REVERSED')),
  reversal_of_transaction_id uuid
    REFERENCES finance.ledger_transactions(ledger_transaction_id) ON DELETE RESTRICT,
  created_by_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_ledger_transaction_posting
    CHECK (status_code = 'DRAFT' OR posted_at IS NOT NULL),
  CONSTRAINT ck_ledger_transaction_not_self_reversal
    CHECK (
      reversal_of_transaction_id IS NULL
      OR reversal_of_transaction_id <> ledger_transaction_id
    )
);

CREATE TABLE finance.ledger_entries (
  ledger_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_transaction_id uuid NOT NULL
    REFERENCES finance.ledger_transactions(ledger_transaction_id) ON DELETE RESTRICT,
  ledger_account_id uuid NOT NULL
    REFERENCES finance.ledger_accounts(ledger_account_id) ON DELETE RESTRICT,
  entry_side_code varchar(10) NOT NULL CHECK (entry_side_code IN ('DEBIT', 'CREDIT')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code char(3) NOT NULL
    REFERENCES reference.currencies(currency_code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ix_ledger_entries_transaction
  ON finance.ledger_entries (ledger_transaction_id);

CREATE INDEX ix_ledger_entries_account_time
  ON finance.ledger_entries (ledger_account_id, created_at DESC);

CREATE TABLE finance.revenue_shares (
  revenue_share_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_type varchar(60) NOT NULL,
  source_entity_id uuid NOT NULL,
  beneficiary_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  basis_code varchar(30) NOT NULL,
  percentage numeric(7,4) CHECK (percentage IS NULL OR percentage BETWEEN 0 AND 100),
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency_code char(3) NOT NULL
    REFERENCES reference.currencies(currency_code) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'CALCULATED'
    CHECK (status_code IN ('CALCULATED', 'APPROVED', 'SETTLED', 'REVERSED')),
  approved_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_revenue_share_value
    CHECK (percentage IS NOT NULL OR amount_minor IS NOT NULL),
  CONSTRAINT ck_revenue_share_approval
    CHECK (
      status_code = 'CALCULATED'
      OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL)
    )
);

CREATE TABLE quality.reputation_model_versions (
  reputation_model_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_code varchar(50) NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  model_definition jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  approved_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_reputation_model_period CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT ck_reputation_model_approval
    CHECK (
      status_code <> 'ACTIVE'
      OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL)
    ),
  UNIQUE (model_code, version_no)
);

CREATE UNIQUE INDEX uq_active_reputation_model
  ON quality.reputation_model_versions (model_code)
  WHERE status_code = 'ACTIVE';

CREATE TABLE quality.corrective_actions (
  quality_corrective_action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid REFERENCES evidence.complaints(complaint_id) ON DELETE RESTRICT,
  evaluation_id uuid REFERENCES evidence.ratings(rating_id) ON DELETE RESTRICT,
  action_code varchar(50) NOT NULL,
  description_ar text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  due_on date,
  status_code varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status_code IN ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
  completed_at timestamptz,
  verified_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  verified_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_quality_action_source
    CHECK (complaint_id IS NOT NULL OR evaluation_id IS NOT NULL),
  CONSTRAINT ck_quality_action_completion
    CHECK (status_code <> 'COMPLETED' OR completed_at IS NOT NULL),
  CONSTRAINT ck_quality_action_verification
    CHECK (
      verified_at IS NULL
      OR (verified_by_party_id IS NOT NULL AND status_code = 'COMPLETED')
    )
);

CREATE TRIGGER trg_quality_corrective_actions_updated
BEFORE UPDATE ON quality.corrective_actions
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TABLE quality.corrective_action_evidence (
  corrective_action_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_corrective_action_id uuid NOT NULL
    REFERENCES quality.corrective_actions(quality_corrective_action_id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL
    REFERENCES evidence.evidence_items(evidence_item_id) ON DELETE RESTRICT,
  evidence_role_code varchar(30) NOT NULL DEFAULT 'COMPLETION',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (quality_corrective_action_id, evidence_item_id)
);

CREATE TABLE governance.access_decisions (
  access_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
  actor_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  resource_type varchar(80) NOT NULL,
  resource_id uuid,
  field_code varchar(120),
  action_code varchar(50) NOT NULL,
  purpose_code varchar(50),
  decision_code varchar(10) NOT NULL CHECK (decision_code IN ('ALLOW', 'DENY')),
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_version_id uuid REFERENCES governance.policy_versions(policy_version_id) ON DELETE RESTRICT,
  correlation_id uuid,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_access_decision_actor
    CHECK (actor_account_id IS NOT NULL OR actor_party_id IS NOT NULL),
  CONSTRAINT ck_access_decision_reason_schema
    CHECK (jsonb_typeof(reason_codes) = 'array')
);

CREATE INDEX ix_access_decisions_actor_time
  ON governance.access_decisions (actor_account_id, decided_at DESC);

CREATE INDEX ix_access_decisions_resource_time
  ON governance.access_decisions (resource_type, resource_id, decided_at DESC);

CREATE TABLE governance.automated_decision_records (
  automated_decision_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  decision_type_code varchar(60) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  model_code varchar(80) NOT NULL,
  model_version varchar(40) NOT NULL,
  input_snapshot jsonb NOT NULL,
  output_snapshot jsonb NOT NULL,
  explanation_ar text NOT NULL,
  decision_code varchar(50) NOT NULL,
  human_review_required boolean NOT NULL DEFAULT false,
  reviewed_by_party_id uuid REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  appeal_status_code varchar(20)
    CHECK (appeal_status_code IS NULL OR appeal_status_code IN (
      'OPEN', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED', 'WITHDRAWN'
    )),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_automated_decision_input_object
    CHECK (jsonb_typeof(input_snapshot) = 'object'),
  CONSTRAINT ck_automated_decision_output_object
    CHECK (jsonb_typeof(output_snapshot) = 'object'),
  CONSTRAINT ck_automated_decision_review
    CHECK (reviewed_at IS NULL OR reviewed_by_party_id IS NOT NULL)
);

CREATE INDEX ix_automated_decisions_subject_time
  ON governance.automated_decision_records (subject_party_id, decided_at DESC);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0200_v71_foundation_non_destructive')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
