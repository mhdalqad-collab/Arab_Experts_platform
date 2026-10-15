BEGIN;

-- Institutional governance, RBAC, delegated access, approvals and policy control.

CREATE TABLE governance.roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(180) NOT NULL,
  name_en varchar(180) NOT NULL,
  role_scope_code varchar(30) NOT NULL
    CHECK (role_scope_code IN ('PUBLIC', 'MEMBER', 'ORGANIZATION', 'PLATFORM')),
  is_system_role boolean NOT NULL DEFAULT false,
  is_privileged boolean NOT NULL DEFAULT false,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED')),
  description_ar text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE governance.permissions (
  permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code varchar(120) NOT NULL UNIQUE,
  name_ar varchar(220) NOT NULL,
  name_en varchar(220) NOT NULL,
  domain_code varchar(60) NOT NULL,
  action_code varchar(40) NOT NULL,
  resource_type varchar(80) NOT NULL,
  risk_level_code varchar(20) NOT NULL DEFAULT 'NORMAL'
    CHECK (risk_level_code IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  requires_step_up_auth boolean NOT NULL DEFAULT false,
  requires_reason boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (domain_code, action_code, resource_type)
);

CREATE TABLE governance.role_permissions (
  role_permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES governance.roles(role_id) ON DELETE CASCADE,
  permission_id uuid NOT NULL
    REFERENCES governance.permissions(permission_id) ON DELETE CASCADE,
  constraint_expression jsonb,
  granted_by_party_id uuid REFERENCES core.parties(party_id),
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  CONSTRAINT ck_role_permission_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (role_id, permission_id, valid_from)
);

CREATE TABLE governance.user_role_assignments (
  user_role_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES governance.roles(role_id) ON DELETE RESTRICT,
  organization_party_id uuid REFERENCES core.organizations(party_id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  assignment_scope jsonb,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED')),
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  assigned_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  assignment_reason text NOT NULL,
  revoked_by_party_id uuid REFERENCES core.parties(party_id),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_user_role_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT ck_user_role_revocation CHECK (
    (status_code = 'REVOKED' AND revoked_at IS NOT NULL AND revoked_by_party_id IS NOT NULL)
    OR status_code <> 'REVOKED'
  )
);

CREATE UNIQUE INDEX uq_active_user_role_scope
  ON governance.user_role_assignments
    (user_account_id, role_id, COALESCE(organization_party_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status_code = 'ACTIVE';

CREATE TABLE governance.access_delegations (
  access_delegation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
  delegate_user_account_id uuid NOT NULL
    REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
  role_id uuid REFERENCES governance.roles(role_id) ON DELETE RESTRICT,
  permission_id uuid REFERENCES governance.permissions(permission_id) ON DELETE RESTRICT,
  scope_expression jsonb,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status_code IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED')),
  reason text NOT NULL,
  approved_by_party_id uuid REFERENCES core.parties(party_id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_delegation_not_self CHECK (delegator_user_account_id <> delegate_user_account_id),
  CONSTRAINT ck_delegation_period CHECK (ends_at > starts_at),
  CONSTRAINT ck_delegation_target CHECK (num_nonnulls(role_id, permission_id) = 1)
);

CREATE TABLE governance.segregation_of_duties_rules (
  sod_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  first_permission_id uuid NOT NULL
    REFERENCES governance.permissions(permission_id) ON DELETE RESTRICT,
  second_permission_id uuid NOT NULL
    REFERENCES governance.permissions(permission_id) ON DELETE RESTRICT,
  enforcement_code varchar(20) NOT NULL DEFAULT 'BLOCK'
    CHECK (enforcement_code IN ('WARN', 'REQUIRE_APPROVAL', 'BLOCK')),
  exception_role_id uuid REFERENCES governance.roles(role_id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_sod_distinct_permissions CHECK (first_permission_id <> second_permission_id),
  UNIQUE (first_permission_id, second_permission_id)
);

CREATE TABLE governance.access_review_campaigns (
  access_review_campaign_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  scope_code varchar(30) NOT NULL
    CHECK (scope_code IN ('ALL', 'PRIVILEGED', 'DOMAIN', 'ORGANIZATION', 'INTEGRATION')),
  scope_filter jsonb,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  starts_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  CONSTRAINT ck_access_review_period CHECK (due_at > starts_at)
);

CREATE TABLE governance.access_review_items (
  access_review_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_review_campaign_id uuid NOT NULL
    REFERENCES governance.access_review_campaigns(access_review_campaign_id) ON DELETE CASCADE,
  user_role_assignment_id uuid
    REFERENCES governance.user_role_assignments(user_role_assignment_id) ON DELETE RESTRICT,
  access_delegation_id uuid
    REFERENCES governance.access_delegations(access_delegation_id) ON DELETE RESTRICT,
  reviewer_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  decision_code varchar(20)
    CHECK (decision_code IN ('KEEP', 'MODIFY', 'REVOKE', 'ESCALATE')),
  decision_reason text,
  decided_at timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status_code IN ('PENDING', 'DECIDED', 'OVERDUE')),
  CONSTRAINT ck_review_item_target
    CHECK (num_nonnulls(user_role_assignment_id, access_delegation_id) = 1)
);

CREATE TABLE governance.approval_requests (
  approval_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_code varchar(60) NOT NULL UNIQUE,
  request_type_code varchar(60) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  requested_action_code varchar(50) NOT NULL,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  request_reason text NOT NULL,
  risk_level_code varchar(20) NOT NULL
    CHECK (risk_level_code IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  minimum_approvals smallint NOT NULL DEFAULT 1 CHECK (minimum_approvals > 0),
  status_code varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status_code IN ('PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  decided_at timestamptz
);

CREATE TABLE governance.approval_decisions (
  approval_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE CASCADE,
  approver_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  decision_code varchar(20) NOT NULL
    CHECK (decision_code IN ('APPROVE', 'REJECT', 'RETURN', 'ABSTAIN')),
  decision_reason text,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (approval_request_id, approver_party_id)
);

CREATE OR REPLACE FUNCTION governance.enforce_approval_separation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  requester_party_id uuid;
BEGIN
  SELECT requested_by_party_id
    INTO requester_party_id
  FROM governance.approval_requests
  WHERE approval_request_id = NEW.approval_request_id;

  IF requester_party_id IS NULL THEN
    RAISE EXCEPTION 'Approval request % does not exist', NEW.approval_request_id;
  END IF;

  IF requester_party_id = NEW.approver_party_id THEN
    RAISE EXCEPTION 'Separation of duties violation: requester cannot approve own request';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approval_decisions_separation
BEFORE INSERT OR UPDATE OF approval_request_id, approver_party_id
ON governance.approval_decisions
FOR EACH ROW EXECUTE FUNCTION governance.enforce_approval_separation();

CREATE TABLE governance.policies (
  policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code varchar(60) NOT NULL UNIQUE,
  canonical_name_ar varchar(300) NOT NULL,
  canonical_name_en varchar(300),
  category_code varchar(40) NOT NULL
    CHECK (category_code IN (
      'GOVERNANCE', 'SECURITY', 'PRIVACY', 'AUDIT', 'FINANCE',
      'CONTENT', 'VERIFICATION', 'BUSINESS_CONTINUITY', 'INTEGRATION'
    )),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);

CREATE TABLE governance.policy_versions (
  policy_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES governance.policies(policy_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_label varchar(40),
  content_ar text NOT NULL,
  content_en text,
  change_summary text NOT NULL,
  effective_from date,
  effective_to date,
  review_due_date date NOT NULL,
  approval_request_id uuid
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  CONSTRAINT ck_policy_version_period
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  UNIQUE (policy_id, version_no)
);

CREATE TABLE governance.policy_acknowledgements (
  policy_acknowledgement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id uuid NOT NULL
    REFERENCES governance.policy_versions(policy_version_id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE CASCADE,
  acknowledgement_code varchar(20) NOT NULL
    CHECK (acknowledgement_code IN ('READ', 'ACCEPTED', 'DECLINED')),
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source_ip inet,
  UNIQUE (policy_version_id, party_id)
);

CREATE TABLE governance.change_requests (
  governance_change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_code varchar(60) NOT NULL UNIQUE,
  change_type_code varchar(40) NOT NULL
    CHECK (change_type_code IN ('POLICY', 'ROLE', 'PERMISSION', 'CONFIGURATION', 'INTEGRATION', 'DATA_MODEL')),
  title_ar varchar(300) NOT NULL,
  description_ar text NOT NULL,
  impact_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_plan text NOT NULL,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  approval_request_id uuid
    REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'ASSESSING', 'APPROVED',
      'IMPLEMENTING', 'VALIDATING', 'COMPLETED', 'REJECTED', 'ROLLED_BACK'
    )),
  planned_at timestamptz,
  implemented_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_user_roles_account_active
  ON governance.user_role_assignments(user_account_id, status_code, valid_to);
CREATE INDEX idx_delegations_delegate_active
  ON governance.access_delegations(delegate_user_account_id, status_code, ends_at);
CREATE INDEX idx_approval_resource
  ON governance.approval_requests(resource_type, resource_id, status_code);
CREATE INDEX idx_policy_review_due
  ON governance.policy_versions(review_due_date)
  WHERE status_code = 'ACTIVE';
CREATE INDEX idx_change_request_status
  ON governance.change_requests(status_code, created_at DESC);

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON governance.roles
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_policies_updated_at
BEFORE UPDATE ON governance.policies
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_changes_updated_at
BEFORE UPDATE ON governance.change_requests
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0170_governance_rbac_policies')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
