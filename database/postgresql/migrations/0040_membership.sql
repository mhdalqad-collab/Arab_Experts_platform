BEGIN;

CREATE TABLE membership.membership_types (
  membership_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_type_code varchar(40) NOT NULL UNIQUE,
  name_ar varchar(120) NOT NULL,
  name_en varchar(120) NOT NULL,
  is_publicly_selectable boolean NOT NULL DEFAULT true,
  requires_review boolean NOT NULL DEFAULT true,
  requires_paid_subscription boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL CHECK (display_order > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE membership.membership_applications (
  membership_application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  membership_type_id uuid NOT NULL
    REFERENCES membership.membership_types(membership_type_id),
  application_no varchar(40) NOT NULL UNIQUE,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'INCOMPLETE', 'READY_TO_SUBMIT', 'SUBMITTED',
      'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'VERIFICATION_PENDING',
      'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'
    )),
  completeness_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (completeness_percentage BETWEEN 0 AND 100),
  submitted_at timestamptz,
  decided_at timestamptz,
  decision_reason_code varchar(50),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by_party_id uuid REFERENCES core.parties(party_id)
);

CREATE UNIQUE INDEX uq_open_membership_application
  ON membership.membership_applications(party_id, membership_type_id)
  WHERE status_code NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

CREATE TABLE membership.membership_application_steps (
  membership_application_step_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_application_id uuid NOT NULL
    REFERENCES membership.membership_applications(membership_application_id)
    ON DELETE CASCADE,
  step_code varchar(60) NOT NULL,
  step_order integer NOT NULL CHECK (step_order > 0),
  status_code varchar(20) NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status_code IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'BLOCKED')),
  completeness_percentage numeric(5,2) NOT NULL DEFAULT 0
    CHECK (completeness_percentage BETWEEN 0 AND 100),
  draft_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (membership_application_id, step_code),
  UNIQUE (membership_application_id, step_order)
);

CREATE TABLE membership.membership_requirements (
  membership_requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_type_id uuid NOT NULL
    REFERENCES membership.membership_types(membership_type_id) ON DELETE CASCADE,
  requirement_code varchar(60) NOT NULL,
  name_ar varchar(180) NOT NULL,
  name_en varchar(180) NOT NULL,
  section_code varchar(60) NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT true,
  validation_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  display_order integer NOT NULL CHECK (display_order > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_membership_requirement_period
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (membership_type_id, requirement_code, effective_from)
);

CREATE TABLE membership.membership_requirement_submissions (
  membership_requirement_submission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_application_id uuid NOT NULL
    REFERENCES membership.membership_applications(membership_application_id)
    ON DELETE CASCADE,
  membership_requirement_id uuid NOT NULL
    REFERENCES membership.membership_requirements(membership_requirement_id),
  status_code varchar(30) NOT NULL DEFAULT 'NOT_PROVIDED'
    CHECK (status_code IN (
      'NOT_PROVIDED', 'PROVIDED', 'UNDER_REVIEW',
      'ACCEPTED', 'REJECTED', 'WAIVED'
    )),
  source_entity_type varchar(80),
  source_entity_id uuid,
  reviewer_comment text,
  reviewed_by_party_id uuid REFERENCES core.parties(party_id),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (membership_application_id, membership_requirement_id)
);

CREATE TABLE membership.membership_reviews (
  membership_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_application_id uuid NOT NULL
    REFERENCES membership.membership_applications(membership_application_id)
    ON DELETE RESTRICT,
  review_type_code varchar(40) NOT NULL,
  reviewer_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  status_code varchar(30) NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status_code IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  recommendation_code varchar(30)
    CHECK (recommendation_code IS NULL OR recommendation_code IN (
      'APPROVE', 'REJECT', 'MORE_INFO_REQUIRED', 'VERIFICATION_REQUIRED'
    )),
  comments text,
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz
);

CREATE TABLE membership.memberships (
  membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  membership_type_id uuid NOT NULL
    REFERENCES membership.membership_types(membership_type_id),
  source_application_id uuid
    REFERENCES membership.membership_applications(membership_application_id),
  membership_number varchar(40) NOT NULL UNIQUE,
  status_code varchar(30) NOT NULL DEFAULT 'PENDING_ACTIVATION'
    CHECK (status_code IN (
      'PENDING_ACTIVATION', 'ACTIVE', 'RESTRICTED', 'SUSPENDED',
      'EXPIRED', 'TERMINATED', 'RESIGNED'
    )),
  activated_at timestamptz,
  valid_from date,
  valid_to date,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by_party_id uuid REFERENCES core.parties(party_id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by_party_id uuid REFERENCES core.parties(party_id),
  CONSTRAINT ck_membership_valid_period
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  UNIQUE (party_id, membership_type_id)
);

CREATE TABLE membership.membership_status_history (
  membership_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL
    REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  from_status_code varchar(30),
  to_status_code varchar(30) NOT NULL,
  reason_code varchar(50),
  comment text,
  changed_by_party_id uuid REFERENCES core.parties(party_id),
  is_automatic boolean NOT NULL DEFAULT false,
  request_id varchar(100),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE membership.membership_application_status_history (
  membership_application_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_application_id uuid NOT NULL
    REFERENCES membership.membership_applications(membership_application_id)
    ON DELETE RESTRICT,
  from_status_code varchar(30),
  to_status_code varchar(30) NOT NULL,
  reason_code varchar(50),
  comment text,
  changed_by_party_id uuid REFERENCES core.parties(party_id),
  is_automatic boolean NOT NULL DEFAULT false,
  request_id varchar(100),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE membership.membership_suspensions (
  membership_suspension_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL
    REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  reason_code varchar(50) NOT NULL,
  reason_details text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  imposed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  lifted_by_party_id uuid REFERENCES core.parties(party_id),
  lifted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_membership_suspension_period
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE OR REPLACE FUNCTION membership.enforce_membership_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_membership_id uuid;
  referenced_party_id uuid;
  expected_party_id uuid;
  referenced_type_code varchar(40);
  allowed_types text[];
BEGIN
  referenced_membership_id :=
    (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  allowed_types := string_to_array(TG_ARGV[2], ',');

  IF referenced_membership_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.party_id, mt.membership_type_code
    INTO referenced_party_id, referenced_type_code
    FROM membership.memberships m
    JOIN membership.membership_types mt
      ON mt.membership_type_id = m.membership_type_id
   WHERE m.membership_id = referenced_membership_id;

  IF referenced_party_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Referenced membership does not exist.';
  END IF;

  IF NOT (referenced_type_code = ANY (allowed_types)) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Membership type %s is not allowed; expected one of %s.',
        referenced_type_code, array_to_string(allowed_types, ', ')
      );
  END IF;

  IF TG_ARGV[1] <> '' THEN
    expected_party_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
    IF expected_party_id IS DISTINCT FROM referenced_party_id THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Membership and entity must belong to the same party.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE INDEX idx_membership_applications_party_status
  ON membership.membership_applications(party_id, status_code);
CREATE INDEX idx_membership_applications_review_queue
  ON membership.membership_applications(status_code, submitted_at)
  WHERE status_code IN ('SUBMITTED', 'UNDER_REVIEW', 'VERIFICATION_PENDING');
CREATE INDEX idx_memberships_party_status
  ON membership.memberships(party_id, status_code);
CREATE INDEX idx_membership_status_history
  ON membership.membership_status_history(membership_id, changed_at DESC);

CREATE TRIGGER trg_membership_types_updated_at
BEFORE UPDATE ON membership.membership_types
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_membership_applications_updated_at
BEFORE UPDATE ON membership.membership_applications
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_membership_steps_updated_at
BEFORE UPDATE ON membership.membership_application_steps
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_membership_requirement_submissions_updated_at
BEFORE UPDATE ON membership.membership_requirement_submissions
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_memberships_updated_at
BEFORE UPDATE ON membership.memberships
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();

CREATE TRIGGER trg_membership_applications_controlled_status
BEFORE UPDATE OF status_code ON membership.membership_applications
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_memberships_controlled_status
BEFORE UPDATE OF status_code ON membership.memberships
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0040_membership')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
