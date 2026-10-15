BEGIN;

CREATE TABLE delivery.engagements (
  engagement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_number varchar(40) NOT NULL UNIQUE,
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  accepted_proposal_id uuid,
  expert_team_id uuid,
  client_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  provider_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  title_ar varchar(320) NOT NULL,
  engagement_type_code varchar(50) NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'PENDING_CONTRACT'
    CHECK (status_code IN (
      'PENDING_CONTRACT', 'READY', 'ACTIVE', 'ON_HOLD',
      'CLOSING', 'COMPLETED', 'TERMINATED', 'CANCELLED'
    )),
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (accepted_proposal_id, service_request_id)
    REFERENCES needs.proposals(proposal_id, service_request_id) ON DELETE RESTRICT,
  FOREIGN KEY (expert_team_id, service_request_id)
    REFERENCES matching.expert_teams(expert_team_id, service_request_id) ON DELETE RESTRICT,
  CONSTRAINT ck_engagement_planned_period
    CHECK (planned_end_date IS NULL OR planned_start_date IS NULL OR planned_end_date >= planned_start_date),
  CONSTRAINT ck_engagement_actual_period
    CHECK (actual_end_date IS NULL OR actual_start_date IS NULL OR actual_end_date >= actual_start_date),
  CONSTRAINT ck_engagement_provider
    CHECK (provider_party_id IS NOT NULL OR expert_team_id IS NOT NULL),
  UNIQUE (service_request_id)
);

CREATE TABLE delivery.engagement_participants (
  engagement_participant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES delivery.engagements(engagement_id) ON DELETE CASCADE,
  participant_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES membership.memberships(membership_id),
  participant_role_code varchar(50) NOT NULL,
  allocation_percentage numeric(5,2)
    CHECK (allocation_percentage IS NULL OR allocation_percentage BETWEEN 0 AND 100),
  authority_level_code varchar(40),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('INVITED', 'ACTIVE', 'RELEASED', 'WITHDRAWN')),
  CONSTRAINT ck_engagement_participant_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (engagement_id, participant_party_id, participant_role_code, valid_from)
);

CREATE TABLE delivery.projects (
  project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES delivery.engagements(engagement_id) ON DELETE RESTRICT,
  project_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(320) NOT NULL,
  name_en varchar(320),
  description_ar text,
  project_manager_party_id uuid REFERENCES core.persons(party_id),
  status_code varchar(30) NOT NULL DEFAULT 'PLANNING'
    CHECK (status_code IN (
      'PLANNING', 'APPROVED', 'ACTIVE', 'ON_HOLD',
      'CLOSING', 'COMPLETED', 'TERMINATED'
    )),
  planned_start_date date NOT NULL,
  planned_end_date date NOT NULL,
  actual_start_date date,
  actual_end_date date,
  completion_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (completion_percentage BETWEEN 0 AND 100),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_project_planned_period CHECK (planned_end_date >= planned_start_date),
  CONSTRAINT ck_project_actual_period
    CHECK (actual_end_date IS NULL OR actual_start_date IS NULL OR actual_end_date >= actual_start_date)
);

CREATE TABLE delivery.project_phases (
  project_phase_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  phase_code varchar(50) NOT NULL,
  name_ar varchar(220) NOT NULL,
  description_ar text,
  phase_order integer NOT NULL CHECK (phase_order > 0),
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status_code IN ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT ck_phase_planned_period
    CHECK (planned_end_date IS NULL OR planned_start_date IS NULL OR planned_end_date >= planned_start_date),
  CONSTRAINT ck_phase_actual_period
    CHECK (actual_end_date IS NULL OR actual_start_date IS NULL OR actual_end_date >= actual_start_date),
  UNIQUE (project_id, phase_code),
  UNIQUE (project_id, phase_order),
  UNIQUE (project_phase_id, project_id)
);

CREATE TABLE delivery.project_tasks (
  project_task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  project_phase_id uuid,
  parent_task_id uuid REFERENCES delivery.project_tasks(project_task_id),
  task_code varchar(60) NOT NULL,
  title_ar varchar(300) NOT NULL,
  description_ar text,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  estimated_effort_hours numeric(10,2)
    CHECK (estimated_effort_hours IS NULL OR estimated_effort_hours >= 0),
  completion_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (completion_percentage BETWEEN 0 AND 100),
  priority_code varchar(20) NOT NULL DEFAULT 'NORMAL',
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status_code IN (
      'PLANNED', 'READY', 'ACTIVE', 'BLOCKED',
      'ON_HOLD', 'COMPLETED', 'CANCELLED'
    )),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (project_phase_id, project_id)
    REFERENCES delivery.project_phases(project_phase_id, project_id) ON DELETE RESTRICT,
  CONSTRAINT ck_task_not_self_parent CHECK (parent_task_id IS NULL OR parent_task_id <> project_task_id),
  CONSTRAINT ck_task_planned_period
    CHECK (planned_end_at IS NULL OR planned_start_at IS NULL OR planned_end_at >= planned_start_at),
  CONSTRAINT ck_task_actual_period
    CHECK (actual_end_at IS NULL OR actual_start_at IS NULL OR actual_end_at >= actual_start_at),
  UNIQUE (project_id, task_code)
);

CREATE TABLE delivery.project_assignments (
  project_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_task_id uuid NOT NULL REFERENCES delivery.project_tasks(project_task_id) ON DELETE CASCADE,
  assignee_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES membership.memberships(membership_id),
  responsibility_code varchar(30) NOT NULL
    CHECK (responsibility_code IN ('ACCOUNTABLE', 'RESPONSIBLE', 'CONSULTED', 'INFORMED', 'SUPPORT')),
  planned_hours numeric(10,2) CHECK (planned_hours IS NULL OR planned_hours >= 0),
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz,
  UNIQUE (project_task_id, assignee_party_id, responsibility_code)
);

CREATE TABLE delivery.milestones (
  milestone_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  milestone_code varchar(60) NOT NULL,
  name_ar varchar(260) NOT NULL,
  description_ar text,
  planned_date date NOT NULL,
  actual_date date,
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status_code IN ('PLANNED', 'DUE', 'ACHIEVED', 'MISSED', 'CANCELLED')),
  payment_trigger boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (project_id, milestone_code),
  UNIQUE (milestone_id, project_id)
);

CREATE TABLE delivery.deliverables (
  deliverable_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid,
  need_deliverable_id uuid REFERENCES needs.need_deliverables(need_deliverable_id),
  deliverable_code varchar(60) NOT NULL,
  name_ar varchar(300) NOT NULL,
  description_ar text,
  acceptance_criteria_ar text NOT NULL,
  planned_due_date date,
  responsible_party_id uuid REFERENCES core.persons(party_id),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'INTERNAL_REVIEW', 'SUBMITTED', 'CLIENT_REVIEW',
      'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'CANCELLED'
    )),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (milestone_id, project_id)
    REFERENCES delivery.milestones(milestone_id, project_id) ON DELETE RESTRICT,
  UNIQUE (project_id, deliverable_code)
);

CREATE TABLE delivery.deliverable_versions (
  deliverable_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES delivery.deliverables(deliverable_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_label varchar(50),
  submission_notes_ar text,
  content_hash char(64),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'INTERNAL_REVIEW', 'SUBMITTED',
      'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED'
    )),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  submitted_at timestamptz,
  UNIQUE (deliverable_id, version_no)
);

CREATE TABLE delivery.deliverable_files (
  deliverable_file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_version_id uuid NOT NULL
    REFERENCES delivery.deliverable_versions(deliverable_version_id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES core.files(file_id) ON DELETE RESTRICT,
  file_role_code varchar(40) NOT NULL DEFAULT 'PRIMARY',
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (deliverable_version_id, file_id)
);

CREATE TABLE delivery.deliverable_reviews (
  deliverable_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_version_id uuid NOT NULL
    REFERENCES delivery.deliverable_versions(deliverable_version_id) ON DELETE RESTRICT,
  reviewer_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  review_type_code varchar(30) NOT NULL
    CHECK (review_type_code IN ('INTERNAL', 'CLIENT', 'QUALITY', 'TECHNICAL')),
  decision_code varchar(30) NOT NULL
    CHECK (decision_code IN ('APPROVE', 'CHANGES_REQUIRED', 'REJECT')),
  comments text,
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (deliverable_version_id, reviewer_party_id, review_type_code)
);

CREATE TABLE delivery.deliverable_acceptances (
  deliverable_acceptance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_version_id uuid NOT NULL UNIQUE
    REFERENCES delivery.deliverable_versions(deliverable_version_id) ON DELETE RESTRICT,
  accepted_by_party_id uuid NOT NULL REFERENCES core.persons(party_id),
  acceptance_code varchar(30) NOT NULL
    CHECK (acceptance_code IN ('ACCEPTED', 'ACCEPTED_WITH_NOTES', 'REJECTED')),
  acceptance_notes text,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payment_release_authorized boolean NOT NULL DEFAULT false
);

CREATE TABLE delivery.change_requests (
  change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE RESTRICT,
  change_request_number varchar(50) NOT NULL UNIQUE,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  title_ar varchar(300) NOT NULL,
  description_ar text NOT NULL,
  justification_ar text NOT NULL,
  change_type_code varchar(40) NOT NULL,
  priority_code varchar(20) NOT NULL DEFAULT 'NORMAL',
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'SUBMITTED', 'IMPACT_ASSESSMENT', 'APPROVAL_PENDING',
      'APPROVED', 'REJECTED', 'IMPLEMENTING', 'IMPLEMENTED', 'CANCELLED'
    )),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE delivery.change_impacts (
  change_impact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id uuid NOT NULL
    REFERENCES delivery.change_requests(change_request_id) ON DELETE CASCADE,
  impact_type_code varchar(30) NOT NULL
    CHECK (impact_type_code IN ('SCOPE', 'TIME', 'COST', 'QUALITY', 'RISK', 'RESOURCE', 'CONTRACT')),
  impact_description_ar text NOT NULL,
  schedule_impact_days integer,
  cost_impact_amount numeric(18,3),
  currency_code char(3) REFERENCES reference.currencies(currency_code),
  assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_change_cost_currency
    CHECK (cost_impact_amount IS NULL OR currency_code IS NOT NULL)
);

CREATE TABLE delivery.project_issues (
  project_issue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  issue_number varchar(50) NOT NULL,
  title_ar varchar(260) NOT NULL,
  description_ar text NOT NULL,
  severity_code varchar(20) NOT NULL
    CHECK (severity_code IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status_code varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status_code IN ('OPEN', 'ANALYZING', 'ACTION_IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  owner_party_id uuid REFERENCES core.persons(party_id),
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (project_id, issue_number)
);

CREATE TABLE delivery.project_risks (
  project_risk_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  risk_number varchar(50) NOT NULL,
  title_ar varchar(260) NOT NULL,
  description_ar text NOT NULL,
  probability_score smallint NOT NULL CHECK (probability_score BETWEEN 1 AND 5),
  impact_score smallint NOT NULL CHECK (impact_score BETWEEN 1 AND 5),
  risk_score smallint GENERATED ALWAYS AS (probability_score * impact_score) STORED,
  response_strategy_code varchar(30),
  response_plan_ar text,
  owner_party_id uuid REFERENCES core.persons(party_id),
  status_code varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status_code IN ('OPEN', 'MONITORING', 'MITIGATING', 'OCCURRED', 'CLOSED')),
  review_date date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (project_id, risk_number)
);

CREATE TABLE delivery.project_decisions (
  project_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  decision_number varchar(50) NOT NULL,
  subject_ar varchar(260) NOT NULL,
  decision_text_ar text NOT NULL,
  rationale_ar text,
  decided_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_date date,
  related_entity_type varchar(80),
  related_entity_id uuid,
  UNIQUE (project_id, decision_number)
);

CREATE TABLE delivery.time_entries (
  time_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_task_id uuid NOT NULL REFERENCES delivery.project_tasks(project_task_id) ON DELETE RESTRICT,
  party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  work_date date NOT NULL,
  hours numeric(6,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  work_description text,
  billable boolean NOT NULL DEFAULT true,
  approval_status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (approval_status_code IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  approved_by_party_id uuid REFERENCES core.parties(party_id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (project_task_id, party_id, work_date, created_at)
);

CREATE TABLE delivery.project_communications (
  project_communication_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  communication_type_code varchar(40) NOT NULL,
  subject_ar varchar(260) NOT NULL,
  summary_ar text,
  occurred_at timestamptz NOT NULL,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE delivery.closure_records (
  closure_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES delivery.projects(project_id) ON DELETE RESTRICT,
  closure_type_code varchar(30) NOT NULL
    CHECK (closure_type_code IN ('COMPLETED', 'TERMINATED', 'CANCELLED')),
  completion_summary_ar text NOT NULL,
  objectives_achievement_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  outstanding_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_signoff_party_id uuid REFERENCES core.persons(party_id),
  closed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  closed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE delivery.lessons_learned (
  lesson_learned_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES delivery.projects(project_id) ON DELETE CASCADE,
  category_code varchar(40) NOT NULL,
  situation_ar text NOT NULL,
  lesson_ar text NOT NULL,
  recommendation_ar text,
  applicability_scope_ar text,
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  approved_for_knowledge_base boolean NOT NULL DEFAULT false,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_engagements_request_status
  ON delivery.engagements(service_request_id, status_code);
CREATE INDEX idx_projects_engagement_status
  ON delivery.projects(engagement_id, status_code);
CREATE INDEX idx_project_tasks_schedule
  ON delivery.project_tasks(project_id, status_code, planned_end_at);
CREATE INDEX idx_project_assignments_party
  ON delivery.project_assignments(assignee_party_id, assigned_at DESC);
CREATE INDEX idx_milestones_due
  ON delivery.milestones(status_code, planned_date);
CREATE INDEX idx_deliverables_due
  ON delivery.deliverables(project_id, status_code, planned_due_date);
CREATE INDEX idx_change_requests_project_status
  ON delivery.change_requests(project_id, status_code);
CREATE INDEX idx_project_issues_open
  ON delivery.project_issues(project_id, severity_code)
  WHERE status_code NOT IN ('RESOLVED', 'CLOSED');
CREATE INDEX idx_project_risks_open
  ON delivery.project_risks(project_id, risk_score DESC)
  WHERE status_code <> 'CLOSED';
CREATE INDEX idx_time_entries_party_date
  ON delivery.time_entries(party_id, work_date DESC);

CREATE TRIGGER trg_engagements_updated_at
BEFORE UPDATE ON delivery.engagements
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_engagements_controlled_status
BEFORE UPDATE OF status_code ON delivery.engagements
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON delivery.projects
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_projects_controlled_status
BEFORE UPDATE OF status_code ON delivery.projects
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_project_tasks_updated_at
BEFORE UPDATE ON delivery.project_tasks
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_project_tasks_controlled_status
BEFORE UPDATE OF status_code ON delivery.project_tasks
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_deliverables_updated_at
BEFORE UPDATE ON delivery.deliverables
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_deliverables_controlled_status
BEFORE UPDATE OF status_code ON delivery.deliverables
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_change_requests_updated_at
BEFORE UPDATE ON delivery.change_requests
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_change_requests_controlled_status
BEFORE UPDATE OF status_code ON delivery.change_requests
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_project_risks_updated_at
BEFORE UPDATE ON delivery.project_risks
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_engagement_participant_membership
BEFORE INSERT OR UPDATE OF membership_id, participant_party_id
ON delivery.engagement_participants
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'membership_id',
  'participant_party_id',
  'EXPERT,TRAINER,CONSULTANT,RESEARCHER_ACADEMIC'
);
CREATE TRIGGER trg_project_assignment_membership
BEFORE INSERT OR UPDATE OF membership_id, assignee_party_id
ON delivery.project_assignments
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'membership_id',
  'assignee_party_id',
  'EXPERT,TRAINER,CONSULTANT,RESEARCHER_ACADEMIC'
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0130_delivery')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
