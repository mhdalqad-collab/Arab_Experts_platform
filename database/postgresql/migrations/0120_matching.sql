BEGIN;

CREATE TABLE matching.matching_weight_sets (
  matching_weight_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE CASCADE,
  name_ar varchar(200) NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  is_default boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (service_request_id, version_no),
  UNIQUE (matching_weight_set_id, service_request_id)
);

CREATE UNIQUE INDEX uq_default_matching_weight_set
  ON matching.matching_weight_sets(service_request_id)
  WHERE is_default;

CREATE TABLE matching.matching_weights (
  matching_weight_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_weight_set_id uuid NOT NULL
    REFERENCES matching.matching_weight_sets(matching_weight_set_id) ON DELETE CASCADE,
  matching_criterion_code varchar(70) NOT NULL
    REFERENCES reference.matching_criteria(matching_criterion_code),
  weight numeric(6,3) NOT NULL CHECK (weight BETWEEN 0 AND 100),
  hard_constraint_json jsonb,
  UNIQUE (matching_weight_set_id, matching_criterion_code)
);

CREATE TABLE matching.matching_runs (
  matching_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  matching_weight_set_id uuid NOT NULL,
  run_number integer NOT NULL CHECK (run_number > 0),
  status_code varchar(30) NOT NULL DEFAULT 'CONFIGURING'
    CHECK (status_code IN (
      'CONFIGURING', 'READY', 'RUNNING', 'COMPLETED', 'FAILED',
      'REVIEWED', 'ACCEPTED_BY_CLIENT', 'SUPERSEDED'
    )),
  algorithm_code varchar(60) NOT NULL DEFAULT 'WEIGHTED_MATCH_V1',
  algorithm_version varchar(30) NOT NULL DEFAULT '1.0',
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (matching_weight_set_id, service_request_id)
    REFERENCES matching.matching_weight_sets(matching_weight_set_id, service_request_id)
    ON DELETE RESTRICT,
  UNIQUE (service_request_id, run_number)
);

CREATE TABLE matching.matching_candidates (
  matching_candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_run_id uuid NOT NULL
    REFERENCES matching.matching_runs(matching_run_id) ON DELETE CASCADE,
  candidate_entity_type varchar(40) NOT NULL
    CHECK (candidate_entity_type IN (
      'EXPERT', 'TRAINER', 'CONSULTANT', 'RESEARCHER',
      'TRAINING_CENTER', 'COURSE_OFFERING', 'EXPERT_TEAM'
    )),
  candidate_entity_id uuid NOT NULL,
  candidate_party_id uuid REFERENCES core.parties(party_id),
  overall_score numeric(7,4) CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 100),
  rank_no integer CHECK (rank_no IS NULL OR rank_no > 0),
  eligibility_code varchar(20) NOT NULL DEFAULT 'ELIGIBLE'
    CHECK (eligibility_code IN ('ELIGIBLE', 'CONDITIONALLY_ELIGIBLE', 'EXCLUDED')),
  exclusion_reason_code varchar(60),
  data_completeness_score numeric(6,5)
    CHECK (data_completeness_score IS NULL OR data_completeness_score BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (matching_run_id, candidate_entity_type, candidate_entity_id),
  UNIQUE (matching_run_id, rank_no)
);

CREATE TABLE matching.matching_scores (
  matching_score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_candidate_id uuid NOT NULL
    REFERENCES matching.matching_candidates(matching_candidate_id) ON DELETE CASCADE,
  matching_criterion_code varchar(70) NOT NULL
    REFERENCES reference.matching_criteria(matching_criterion_code),
  raw_score numeric(7,4) NOT NULL CHECK (raw_score BETWEEN 0 AND 100),
  applied_weight numeric(6,3) NOT NULL CHECK (applied_weight BETWEEN 0 AND 100),
  weighted_score numeric(7,4)
    GENERATED ALWAYS AS (round(raw_score * applied_weight / 100.0, 4)) STORED,
  confidence_score numeric(6,5) CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (matching_candidate_id, matching_criterion_code)
);

CREATE TABLE matching.matching_explanations (
  matching_explanation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_candidate_id uuid NOT NULL
    REFERENCES matching.matching_candidates(matching_candidate_id) ON DELETE CASCADE,
  explanation_type_code varchar(40) NOT NULL,
  matching_criterion_code varchar(70)
    REFERENCES reference.matching_criteria(matching_criterion_code),
  explanation_ar text NOT NULL,
  supporting_entity_type varchar(80),
  supporting_entity_id uuid,
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (matching_candidate_id, display_order)
);

CREATE TABLE matching.matching_feedback (
  matching_feedback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_run_id uuid NOT NULL
    REFERENCES matching.matching_runs(matching_run_id) ON DELETE RESTRICT,
  candidate_entity_type varchar(40) NOT NULL,
  candidate_entity_id uuid NOT NULL,
  feedback_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  outcome_code varchar(40) NOT NULL,
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE matching.comparisons (
  comparison_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  service_request_id uuid REFERENCES needs.service_requests(service_request_id),
  comparison_type_code varchar(40) NOT NULL,
  title_ar varchar(220),
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('ACTIVE', 'DECIDED', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE matching.comparison_items (
  comparison_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id uuid NOT NULL
    REFERENCES matching.comparisons(comparison_id) ON DELETE CASCADE,
  entity_type varchar(40) NOT NULL,
  entity_id uuid NOT NULL,
  matching_candidate_id uuid
    REFERENCES matching.matching_candidates(matching_candidate_id),
  display_order integer NOT NULL CHECK (display_order > 0),
  added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (comparison_id, entity_type, entity_id),
  UNIQUE (comparison_id, display_order)
);

CREATE TABLE matching.shortlists (
  shortlist_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE CASCADE,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  name_ar varchar(200) NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'FINAL', 'SUPERSEDED', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finalized_at timestamptz,
  UNIQUE (service_request_id, version_no)
);

CREATE TABLE matching.shortlist_items (
  shortlist_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES matching.shortlists(shortlist_id) ON DELETE CASCADE,
  candidate_entity_type varchar(40) NOT NULL,
  candidate_entity_id uuid NOT NULL,
  matching_candidate_id uuid REFERENCES matching.matching_candidates(matching_candidate_id),
  client_rank integer CHECK (client_rank IS NULL OR client_rank > 0),
  decision_code varchar(30) NOT NULL DEFAULT 'UNDER_CONSIDERATION'
    CHECK (decision_code IN (
      'UNDER_CONSIDERATION', 'INVITE', 'SELECT', 'RESERVE', 'REJECT'
    )),
  decision_reason text,
  added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (shortlist_id, candidate_entity_type, candidate_entity_id),
  UNIQUE (shortlist_id, client_rank)
);

CREATE TABLE matching.client_candidate_decisions (
  client_candidate_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  shortlist_item_id uuid NOT NULL
    REFERENCES matching.shortlist_items(shortlist_item_id) ON DELETE RESTRICT,
  decision_code varchar(30) NOT NULL
    CHECK (decision_code IN ('SELECTED', 'RESERVE', 'NOT_SELECTED', 'MORE_INFO_REQUIRED')),
  rationale text,
  decided_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (service_request_id, shortlist_item_id)
);

CREATE TABLE matching.expert_teams (
  expert_team_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL
    REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  team_code varchar(50) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DISBANDED')),
  lead_party_id uuid REFERENCES core.persons(party_id),
  compatibility_score numeric(7,4)
    CHECK (compatibility_score IS NULL OR compatibility_score BETWEEN 0 AND 100),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (expert_team_id, service_request_id)
);

CREATE TABLE matching.team_role_requirements (
  team_role_requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_team_id uuid NOT NULL
    REFERENCES matching.expert_teams(expert_team_id) ON DELETE CASCADE,
  role_code varchar(50) NOT NULL,
  taxonomy_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  experience_level_code varchar(40)
    REFERENCES reference.experience_levels(experience_level_code),
  required_count integer NOT NULL DEFAULT 1 CHECK (required_count > 0),
  is_mandatory boolean NOT NULL DEFAULT true,
  UNIQUE (expert_team_id, role_code, taxonomy_node_id)
);

CREATE TABLE matching.expert_team_members (
  expert_team_member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_team_id uuid NOT NULL
    REFERENCES matching.expert_teams(expert_team_id) ON DELETE CASCADE,
  member_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL REFERENCES membership.memberships(membership_id),
  team_role_code varchar(50) NOT NULL,
  allocation_percentage numeric(5,2)
    CHECK (allocation_percentage IS NULL OR allocation_percentage BETWEEN 0 AND 100),
  responsibility_description_ar text,
  status_code varchar(20) NOT NULL DEFAULT 'PROPOSED'
    CHECK (status_code IN ('PROPOSED', 'INVITED', 'ACCEPTED', 'DECLINED', 'ACTIVE', 'RELEASED')),
  joined_at timestamptz,
  left_at timestamptz,
  UNIQUE (expert_team_id, member_party_id, team_role_code)
);

CREATE TABLE matching.team_compatibility_scores (
  team_compatibility_score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_team_id uuid NOT NULL
    REFERENCES matching.expert_teams(expert_team_id) ON DELETE CASCADE,
  criterion_code varchar(60) NOT NULL,
  score numeric(7,4) NOT NULL CHECK (score BETWEEN 0 AND 100),
  explanation_ar text,
  calculated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (expert_team_id, criterion_code)
);

CREATE OR REPLACE FUNCTION matching.validate_weight_set_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_weight numeric(8,3);
  criterion_count integer;
BEGIN
  IF NEW.is_locked AND NOT OLD.is_locked THEN
    SELECT COALESCE(sum(weight), 0), count(*)
      INTO total_weight, criterion_count
      FROM matching.matching_weights
     WHERE matching_weight_set_id = NEW.matching_weight_set_id;

    IF criterion_count = 0 OR total_weight <> 100.000 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = format(
          'Matching weights must total 100 before locking; current total is %s.',
          total_weight
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION matching.reject_locked_weight_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  weight_set_id uuid;
  locked boolean;
BEGIN
  weight_set_id := COALESCE(NEW.matching_weight_set_id, OLD.matching_weight_set_id);
  SELECT is_locked INTO locked
    FROM matching.matching_weight_sets
   WHERE matching_weight_set_id = weight_set_id;

  IF locked THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'A locked matching weight set cannot be changed.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE INDEX idx_matching_runs_request
  ON matching.matching_runs(service_request_id, run_number DESC);
CREATE INDEX idx_matching_candidates_rank
  ON matching.matching_candidates(matching_run_id, rank_no)
  WHERE eligibility_code <> 'EXCLUDED';
CREATE INDEX idx_matching_candidates_party
  ON matching.matching_candidates(candidate_party_id);
CREATE INDEX idx_comparisons_owner
  ON matching.comparisons(owner_party_id, created_at DESC);
CREATE INDEX idx_shortlists_request
  ON matching.shortlists(service_request_id, version_no DESC);
CREATE INDEX idx_team_members_party
  ON matching.expert_team_members(member_party_id, status_code);

CREATE TRIGGER trg_matching_runs_updated_at
BEFORE UPDATE ON matching.matching_runs
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_matching_runs_controlled_status
BEFORE UPDATE OF status_code ON matching.matching_runs
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_matching_weight_set_lock
BEFORE UPDATE OF is_locked ON matching.matching_weight_sets
FOR EACH ROW EXECUTE FUNCTION matching.validate_weight_set_lock();
CREATE TRIGGER trg_matching_weights_locked_guard
BEFORE INSERT OR UPDATE OR DELETE ON matching.matching_weights
FOR EACH ROW EXECUTE FUNCTION matching.reject_locked_weight_change();
CREATE TRIGGER trg_comparisons_updated_at
BEFORE UPDATE ON matching.comparisons
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_expert_teams_updated_at
BEFORE UPDATE ON matching.expert_teams
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_expert_teams_controlled_status
BEFORE UPDATE OF status_code ON matching.expert_teams
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_expert_team_member_membership
BEFORE INSERT OR UPDATE OF membership_id, member_party_id
ON matching.expert_team_members
FOR EACH ROW EXECUTE FUNCTION membership.enforce_membership_reference(
  'membership_id',
  'member_party_id',
  'EXPERT,TRAINER,CONSULTANT,RESEARCHER_ACADEMIC'
);

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0120_matching')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
