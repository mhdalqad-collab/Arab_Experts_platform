BEGIN;

CREATE TABLE delivery.workflow_incident_root_cause_analyses (
  workflow_incident_root_cause_analysis_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_operations_incident_id uuid NOT NULL UNIQUE REFERENCES delivery.workflow_operations_incidents(workflow_operations_incident_id) ON DELETE RESTRICT,
  method_code varchar(24) NOT NULL CHECK (method_code IN ('FIVE_WHYS','FISHBONE','FAULT_TREE','TIMELINE','OTHER')),
  root_cause_summary text NOT NULL CHECK (length(btrim(root_cause_summary))>=20),
  contributing_factors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(contributing_factors)='array'),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs)='array'),
  prepared_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_incident_rca_independent_review CHECK (reviewed_by_party_id IS NULL OR reviewed_by_party_id<>prepared_by_party_id)
);

CREATE TABLE delivery.workflow_incident_corrective_actions (
  workflow_incident_corrective_action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_operations_incident_id uuid NOT NULL REFERENCES delivery.workflow_operations_incidents(workflow_operations_incident_id) ON DELETE RESTRICT,
  action_code varchar(40) NOT NULL,
  action_type_code varchar(20) NOT NULL CHECK (action_type_code IN ('CONTAINMENT','CORRECTIVE','PREVENTIVE')),
  description text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  due_at timestamptz NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status_code IN ('OPEN','IN_PROGRESS','IMPLEMENTED','VERIFIED','CANCELLED')),
  implemented_at timestamptz,
  verified_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  verified_at timestamptz,
  effectiveness_code varchar(20) CHECK (effectiveness_code IN ('EFFECTIVE','PARTIALLY_EFFECTIVE','INEFFECTIVE')),
  verification_note text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workflow_operations_incident_id,action_code),
  CONSTRAINT ck_incident_action_verification CHECK (
    (status_code='VERIFIED' AND verified_by_party_id IS NOT NULL AND verified_at IS NOT NULL AND effectiveness_code IS NOT NULL)
    OR status_code<>'VERIFIED'
  )
);

CREATE TABLE delivery.workflow_incident_lessons (
  workflow_incident_lesson_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_operations_incident_id uuid NOT NULL REFERENCES delivery.workflow_operations_incidents(workflow_operations_incident_id) ON DELETE RESTRICT,
  lesson_summary text NOT NULL CHECK (length(btrim(lesson_summary))>=20),
  audience_code varchar(20) NOT NULL CHECK (audience_code IN ('OPERATIONS','ENGINEERING','GOVERNANCE','ALL_STAFF')),
  knowledge_asset_id uuid REFERENCES knowledge.knowledge_assets(knowledge_asset_id) ON DELETE SET NULL,
  approved_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION delivery.transition_workflow_operations_incident(
  p_incident_id uuid,p_actor_user_account_id uuid,p_to_status varchar,p_note text,
  p_owner_party_id uuid DEFAULT NULL,p_step_up_verified boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,delivery,governance,iam AS $$
DECLARE v_actor uuid; v_incident delivery.workflow_operations_incidents%ROWTYPE;
BEGIN
  SELECT party_id INTO v_actor FROM iam.user_accounts WHERE user_account_id=p_actor_user_account_id AND status_code='ACTIVE';
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM governance.user_role_assignments ura JOIN governance.roles r ON r.role_id=ura.role_id WHERE ura.user_account_id=p_actor_user_account_id AND ura.status_code='ACTIVE' AND r.role_code IN('PLATFORM_ADMIN','PLATFORM_OPERATOR')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Operations role is required'; END IF;
  SELECT * INTO v_incident FROM delivery.workflow_operations_incidents WHERE workflow_operations_incident_id=p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','REJECTED','code','INCIDENT_NOT_FOUND'); END IF;
  IF p_to_status IN('RESOLVED','CLOSED') AND NOT p_step_up_verified THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Step-up verification is required for resolution'; END IF;
  IF p_to_status='CLOSED' AND (
    NOT EXISTS(SELECT 1 FROM delivery.workflow_incident_root_cause_analyses WHERE workflow_operations_incident_id=p_incident_id AND reviewed_at IS NOT NULL)
    OR EXISTS(SELECT 1 FROM delivery.workflow_incident_corrective_actions WHERE workflow_operations_incident_id=p_incident_id AND status_code NOT IN('VERIFIED','CANCELLED'))
    OR NOT EXISTS(SELECT 1 FROM delivery.workflow_incident_corrective_actions WHERE workflow_operations_incident_id=p_incident_id AND status_code='VERIFIED')
  ) THEN RETURN jsonb_build_object('status','REJECTED','code','CLOSURE_EVIDENCE_INCOMPLETE'); END IF;
  UPDATE delivery.workflow_operations_incidents SET status_code=p_to_status,owner_party_id=coalesce(p_owner_party_id,owner_party_id),
    acknowledged_at=CASE WHEN p_to_status='ACKNOWLEDGED' THEN clock_timestamp() ELSE acknowledged_at END,
    resolved_at=CASE WHEN p_to_status IN('RESOLVED','CLOSED') THEN coalesce(resolved_at,clock_timestamp()) ELSE resolved_at END,
    updated_at=clock_timestamp() WHERE workflow_operations_incident_id=p_incident_id;
  INSERT INTO delivery.workflow_operations_incident_events(workflow_operations_incident_id,event_code,from_status_code,to_status_code,actor_party_id,note)
  VALUES(p_incident_id,CASE p_to_status WHEN 'ACKNOWLEDGED' THEN 'ACKNOWLEDGED' WHEN 'INVESTIGATING' THEN 'INVESTIGATION' WHEN 'MITIGATED' THEN 'MITIGATED' WHEN 'RESOLVED' THEN 'RESOLVED' WHEN 'CLOSED' THEN 'CLOSED' ELSE 'COMMENT' END,v_incident.status_code,p_to_status,v_actor,p_note);
  RETURN jsonb_build_object('status','SUCCEEDED','from',v_incident.status_code,'to',p_to_status);
END $$;

CREATE VIEW delivery.v_workflow_incident_closure_readiness AS
SELECT i.workflow_operations_incident_id,i.incident_code,i.status_code,
  EXISTS(SELECT 1 FROM delivery.workflow_incident_root_cause_analyses r WHERE r.workflow_operations_incident_id=i.workflow_operations_incident_id AND r.reviewed_at IS NOT NULL) AS root_cause_reviewed,
  count(a.*) FILTER(WHERE a.status_code NOT IN('VERIFIED','CANCELLED')) AS open_actions,
  count(a.*) FILTER(WHERE a.status_code='VERIFIED') AS verified_actions,
  EXISTS(SELECT 1 FROM delivery.workflow_incident_lessons l WHERE l.workflow_operations_incident_id=i.workflow_operations_incident_id) AS lesson_recorded
FROM delivery.workflow_operations_incidents i LEFT JOIN delivery.workflow_incident_corrective_actions a ON a.workflow_operations_incident_id=i.workflow_operations_incident_id
GROUP BY i.workflow_operations_incident_id,i.incident_code,i.status_code;

COMMIT;
