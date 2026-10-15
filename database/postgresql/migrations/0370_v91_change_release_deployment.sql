BEGIN;

CREATE TABLE delivery.platform_change_requests (
  platform_change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_code varchar(40) NOT NULL UNIQUE,
  title varchar(240) NOT NULL,
  change_type_code varchar(20) NOT NULL CHECK(change_type_code IN('STANDARD','NORMAL','EMERGENCY')),
  risk_code varchar(12) NOT NULL CHECK(risk_code IN('LOW','MEDIUM','HIGH','CRITICAL')),
  status_code varchar(24) NOT NULL DEFAULT 'DRAFT' CHECK(status_code IN('DRAFT','ASSESSMENT','PENDING_APPROVAL','APPROVED','SCHEDULED','IMPLEMENTED','VERIFIED','FAILED','ROLLED_BACK','CANCELLED')),
  business_reason text NOT NULL,
  impact_assessment text NOT NULL,
  implementation_plan text NOT NULL,
  validation_plan text NOT NULL,
  rollback_plan text NOT NULL,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approval_request_id uuid REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(planned_end_at IS NULL OR planned_start_at IS NULL OR planned_end_at>planned_start_at)
);

CREATE TABLE delivery.platform_releases (
  platform_release_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_code varchar(50) NOT NULL UNIQUE,
  version_label varchar(50) NOT NULL UNIQUE,
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED' CHECK(status_code IN('PLANNED','READY','APPROVED','DEPLOYING','DEPLOYED','VERIFIED','FAILED','ROLLED_BACK','RETIRED')),
  release_notes text NOT NULL,
  artifact_digest varchar(128) NOT NULL,
  database_target_version varchar(30),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(approved_by_party_id IS NULL OR approved_by_party_id<>created_by_party_id)
);

CREATE TABLE delivery.platform_release_changes (
  platform_release_id uuid NOT NULL REFERENCES delivery.platform_releases(platform_release_id) ON DELETE RESTRICT,
  platform_change_request_id uuid NOT NULL REFERENCES delivery.platform_change_requests(platform_change_request_id) ON DELETE RESTRICT,
  sequence_no integer NOT NULL CHECK(sequence_no>0),
  PRIMARY KEY(platform_release_id,platform_change_request_id),
  UNIQUE(platform_release_id,sequence_no)
);

CREATE TABLE delivery.platform_deployments (
  platform_deployment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_release_id uuid NOT NULL REFERENCES delivery.platform_releases(platform_release_id) ON DELETE RESTRICT,
  environment_code varchar(16) NOT NULL CHECK(environment_code IN('TEST','STAGING','PRODUCTION')),
  deployment_status_code varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(deployment_status_code IN('PENDING','BLOCKED','RUNNING','SUCCEEDED','FAILED','ROLLING_BACK','ROLLED_BACK')),
  readiness_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(readiness_snapshot)='object'),
  initiated_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  started_at timestamptz,
  completed_at timestamptz,
  rollback_started_at timestamptz,
  correlation_id varchar(120),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION delivery.evaluate_production_deployment_gate(p_release_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,delivery AS $$
DECLARE v_reasons jsonb:='[]'::jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM delivery.workflow_operations_incidents WHERE severity_code IN('SEV1','SEV2') AND status_code NOT IN('RESOLVED','CLOSED')) THEN v_reasons:=v_reasons||jsonb_build_array('CRITICAL_INCIDENT_OPEN'); END IF;
 IF EXISTS(SELECT 1 FROM delivery.v_workflow_reliability_dashboard WHERE compliance_code='BREACHED') THEN v_reasons:=v_reasons||jsonb_build_array('SLO_BREACHED'); END IF;
 IF EXISTS(SELECT 1 FROM delivery.platform_release_changes rc JOIN delivery.platform_change_requests c ON c.platform_change_request_id=rc.platform_change_request_id WHERE rc.platform_release_id=p_release_id AND c.status_code NOT IN('APPROVED','SCHEDULED','IMPLEMENTED','VERIFIED')) THEN v_reasons:=v_reasons||jsonb_build_array('CHANGE_NOT_APPROVED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM delivery.platform_release_changes WHERE platform_release_id=p_release_id) THEN v_reasons:=v_reasons||jsonb_build_array('EMPTY_RELEASE'); END IF;
 RETURN jsonb_build_object('decision',CASE WHEN jsonb_array_length(v_reasons)=0 THEN 'ALLOW' ELSE 'BLOCK' END,'reasons',v_reasons,'evaluatedAt',clock_timestamp());
END $$;

COMMIT;
