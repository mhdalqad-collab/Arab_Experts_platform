BEGIN;

CREATE TABLE needs.client_needs (
  client_need_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL
    REFERENCES crm.client_accounts(client_account_id) ON DELETE RESTRICT,
  need_number varchar(40) NOT NULL UNIQUE,
  need_type_code varchar(70) NOT NULL REFERENCES reference.need_types(need_type_code),
  title_ar varchar(320) NOT NULL,
  title_en varchar(320),
  description_ar text,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'INCOMPLETE', 'READY', 'VALIDATED',
      'CONVERTED', 'ON_HOLD', 'CANCELLED', 'ARCHIVED'
    )),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  completeness_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (completeness_percentage BETWEEN 0 AND 100),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE needs.need_versions (
  need_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_need_id uuid NOT NULL
    REFERENCES needs.client_needs(client_need_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  title_ar varchar(320) NOT NULL,
  description_ar text NOT NULL,
  business_context_ar text,
  success_definition_ar text,
  change_summary text,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_current boolean NOT NULL DEFAULT false,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (client_need_id, version_no),
  UNIQUE (need_version_id, client_need_id)
);

CREATE UNIQUE INDEX uq_current_need_version
  ON needs.need_versions(client_need_id) WHERE is_current;

CREATE TABLE needs.need_objectives (
  need_objective_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  objective_ar text NOT NULL,
  success_measure_ar text,
  priority_rank smallint NOT NULL CHECK (priority_rank BETWEEN 1 AND 5),
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (need_version_id, display_order)
);

CREATE TABLE needs.need_deliverables (
  need_deliverable_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  deliverable_name_ar varchar(300) NOT NULL,
  description_ar text,
  acceptance_criteria_ar text,
  desired_due_date date,
  is_mandatory boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (need_version_id, display_order)
);

CREATE TABLE needs.need_constraints (
  need_constraint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  constraint_type_code varchar(40) NOT NULL
    CHECK (constraint_type_code IN (
      'BUDGET', 'SCHEDULE', 'LOCATION', 'LANGUAGE', 'DELIVERY_MODE',
      'CONFIDENTIALITY', 'REGULATORY', 'TECHNICAL', 'OTHER'
    )),
  operator_code varchar(20),
  value_json jsonb NOT NULL,
  is_hard_constraint boolean NOT NULL DEFAULT false,
  priority_rank smallint CHECK (priority_rank IS NULL OR priority_rank BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE needs.need_budgets (
  need_budget_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL UNIQUE
    REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  minimum_amount numeric(18,3) CHECK (minimum_amount IS NULL OR minimum_amount >= 0),
  maximum_amount numeric(18,3) CHECK (maximum_amount IS NULL OR maximum_amount >= 0),
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  budget_visibility_code varchar(30) NOT NULL DEFAULT 'INTERNAL'
    CHECK (budget_visibility_code IN ('PUBLIC', 'CANDIDATES', 'INTERNAL')),
  CONSTRAINT ck_need_budget_range
    CHECK (maximum_amount IS NULL OR minimum_amount IS NULL OR maximum_amount >= minimum_amount)
);

CREATE TABLE needs.need_taxonomy_assignments (
  need_taxonomy_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  taxonomy_node_id uuid NOT NULL REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  assignment_role_code varchar(30) NOT NULL DEFAULT 'PRIMARY',
  importance_weight numeric(6,3) CHECK (importance_weight IS NULL OR importance_weight BETWEEN 0 AND 100),
  UNIQUE (need_version_id, taxonomy_node_id, assignment_role_code)
);

CREATE TABLE needs.need_required_capabilities (
  need_required_capability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  service_catalog_item_id uuid
    REFERENCES services.service_catalog_items(service_catalog_item_id),
  taxonomy_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  experience_level_code varchar(40)
    REFERENCES reference.experience_levels(experience_level_code),
  expert_role_code varchar(50) REFERENCES reference.expert_roles(expert_role_code),
  minimum_years_experience integer
    CHECK (minimum_years_experience IS NULL OR minimum_years_experience BETWEEN 0 AND 80),
  description_ar text,
  is_mandatory boolean NOT NULL DEFAULT true,
  CONSTRAINT ck_required_capability_definition
    CHECK (service_catalog_item_id IS NOT NULL OR taxonomy_node_id IS NOT NULL)
);

CREATE TABLE needs.need_evidence_requirements (
  need_evidence_requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  evidence_type_code varchar(60) NOT NULL,
  minimum_certainty_score numeric(6,5)
    CHECK (minimum_certainty_score IS NULL OR minimum_certainty_score BETWEEN 0 AND 1),
  minimum_evidence_count integer NOT NULL DEFAULT 1 CHECK (minimum_evidence_count > 0),
  is_mandatory boolean NOT NULL DEFAULT false
);

CREATE TABLE needs.task_fingerprints (
  task_fingerprint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_version_id uuid NOT NULL UNIQUE
    REFERENCES needs.need_versions(need_version_id) ON DELETE CASCADE,
  fingerprint_code varchar(60) NOT NULL UNIQUE,
  title_ar varchar(300) NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'READY', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
  complexity_level smallint CHECK (complexity_level IS NULL OR complexity_level BETWEEN 1 AND 5),
  uncertainty_level smallint CHECK (uncertainty_level IS NULL OR uncertainty_level BETWEEN 1 AND 5),
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE needs.task_fingerprint_components (
  task_fingerprint_component_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_fingerprint_id uuid NOT NULL
    REFERENCES needs.task_fingerprints(task_fingerprint_id) ON DELETE CASCADE,
  component_type_code varchar(50) NOT NULL,
  taxonomy_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  description_ar text NOT NULL,
  required_level numeric(6,5) CHECK (required_level IS NULL OR required_level BETWEEN 0 AND 1),
  importance_weight numeric(6,3) NOT NULL CHECK (importance_weight BETWEEN 0 AND 100),
  is_hard_constraint boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (task_fingerprint_id, display_order)
);

CREATE TABLE needs.service_requests (
  service_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_need_id uuid NOT NULL REFERENCES needs.client_needs(client_need_id) ON DELETE RESTRICT,
  need_version_id uuid NOT NULL,
  request_number varchar(40) NOT NULL UNIQUE,
  title_ar varchar(320) NOT NULL,
  submission_deadline timestamptz,
  desired_start_date date,
  desired_end_date date,
  status_code varchar(40) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'QUALIFICATION', 'CLARIFICATION_REQUIRED',
      'APPROVED_FOR_MATCHING', 'MATCHING', 'CANDIDATES_READY',
      'PROPOSALS_OPEN', 'EVALUATION', 'SHORTLISTED', 'SELECTED',
      'CONTRACTING', 'IN_DELIVERY', 'ACCEPTANCE', 'COMPLETED',
      'ON_HOLD', 'CANCELLED', 'CLOSED_NO_AWARD'
    )),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  submitted_by_party_id uuid REFERENCES core.parties(party_id),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (need_version_id, client_need_id)
    REFERENCES needs.need_versions(need_version_id, client_need_id) ON DELETE RESTRICT,
  CONSTRAINT ck_service_request_dates
    CHECK (desired_end_date IS NULL OR desired_start_date IS NULL OR desired_end_date >= desired_start_date)
);

CREATE TABLE needs.service_request_status_history (
  service_request_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  from_status_code varchar(40),
  to_status_code varchar(40) NOT NULL,
  reason_code varchar(50),
  comment text,
  changed_by_party_id uuid REFERENCES core.parties(party_id),
  is_automatic boolean NOT NULL DEFAULT false,
  request_id varchar(100),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE needs.service_request_attachments (
  service_request_attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  attachment_role_code varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (service_request_id, file_id)
);

CREATE TABLE needs.request_invitations (
  request_invitation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE CASCADE,
  invited_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  invited_membership_id uuid REFERENCES membership.memberships(membership_id),
  invitation_status_code varchar(30) NOT NULL DEFAULT 'SENT'
    CHECK (invitation_status_code IN ('SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
  sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz,
  responded_at timestamptz,
  UNIQUE (service_request_id, invited_party_id)
);

CREATE TABLE needs.provider_responses (
  provider_response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_invitation_id uuid NOT NULL UNIQUE
    REFERENCES needs.request_invitations(request_invitation_id) ON DELETE RESTRICT,
  response_code varchar(30) NOT NULL
    CHECK (response_code IN ('INTERESTED', 'NOT_INTERESTED', 'NEEDS_CLARIFICATION')),
  comment text,
  responded_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  responded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE needs.proposals (
  proposal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  provider_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  provider_membership_id uuid REFERENCES membership.memberships(membership_id),
  proposal_number varchar(50) NOT NULL UNIQUE,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED',
      'REVISED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'
    )),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  valid_until date,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (service_request_id, provider_party_id),
  UNIQUE (proposal_id, service_request_id)
);

CREATE TABLE needs.proposal_versions (
  proposal_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES needs.proposals(proposal_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  technical_approach_ar text NOT NULL,
  work_plan_ar text,
  deliverables_ar text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  proposed_amount numeric(18,3) NOT NULL CHECK (proposed_amount >= 0),
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  assumptions_ar text,
  exclusions_ar text,
  submitted_at timestamptz,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (proposal_id, version_no)
);

CREATE INDEX idx_client_needs_client_status
  ON needs.client_needs(client_account_id, status_code);
CREATE INDEX idx_need_taxonomy_node
  ON needs.need_taxonomy_assignments(taxonomy_node_id);
CREATE INDEX idx_service_requests_queue
  ON needs.service_requests(status_code, submitted_at);
CREATE INDEX idx_request_invitations_party
  ON needs.request_invitations(invited_party_id, invitation_status_code);
CREATE INDEX idx_proposals_request_status
  ON needs.proposals(service_request_id, status_code);

CREATE TRIGGER trg_client_needs_updated_at
BEFORE UPDATE ON needs.client_needs
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_client_needs_controlled_status
BEFORE UPDATE OF status_code ON needs.client_needs
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_task_fingerprints_updated_at
BEFORE UPDATE ON needs.task_fingerprints
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_service_requests_updated_at
BEFORE UPDATE ON needs.service_requests
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_service_requests_controlled_status
BEFORE UPDATE OF status_code ON needs.service_requests
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_proposals_updated_at
BEFORE UPDATE ON needs.proposals
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_proposal_provider_membership
BEFORE INSERT OR UPDATE OF provider_membership_id, provider_party_id
ON needs.proposals
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'provider_membership_id',
  'provider_party_id',
  'EXPERT,TRAINER,CONSULTANT,RESEARCHER_ACADEMIC,TRAINING_CENTER'
);
CREATE TRIGGER trg_proposals_controlled_status
BEFORE UPDATE OF status_code ON needs.proposals
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0110_needs')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
