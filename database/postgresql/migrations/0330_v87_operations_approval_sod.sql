BEGIN;

CREATE TABLE delivery.workflow_operations_approval_links (
  workflow_operations_approval_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL UNIQUE REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  workflow_operations_command_receipt_id uuid NOT NULL UNIQUE REFERENCES delivery.workflow_operations_command_receipts(workflow_operations_command_receipt_id) ON DELETE RESTRICT,
  target_percentage numeric(5,2) CHECK (target_percentage IS NULL OR target_percentage BETWEEN 1 AND 100),
  execution_status_code varchar(20) NOT NULL DEFAULT 'AWAITING_DECISION' CHECK (execution_status_code IN ('AWAITING_DECISION','APPROVED','REJECTED','EXPIRED','EXECUTED','EXECUTION_FAILED')),
  executed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  executed_at timestamptz,
  execution_result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ix_workflow_operations_approvals_status ON delivery.workflow_operations_approval_links(execution_status_code,created_at);

CREATE OR REPLACE FUNCTION delivery.request_workflow_operations_approval(
  p_idempotency_key varchar,p_command_code varchar,p_rollout_plan_id uuid,
  p_actor_user_account_id uuid,p_reason text,p_step_up_verified boolean,
  p_target_percentage numeric DEFAULT NULL,p_correlation_id varchar DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,delivery,governance,iam AS $$
DECLARE v_party uuid; v_receipt uuid; v_approval uuid; v_hash varchar(64); v_existing delivery.workflow_operations_command_receipts%ROWTYPE;
BEGIN
  IF p_command_code NOT IN ('PAUSE_ROLLOUT','REQUEST_PROMOTION') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Approval command is not supported'; END IF;
  IF NOT p_step_up_verified THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Trusted step-up verification is required'; END IF;
  IF length(btrim(coalesce(p_reason,'')))<8 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operational reason must contain at least 8 characters'; END IF;
  IF p_command_code='REQUEST_PROMOTION' AND (p_target_percentage IS NULL OR p_target_percentage NOT BETWEEN 1 AND 100) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid promotion percentage is required'; END IF;
  SELECT party_id INTO v_party FROM iam.user_accounts WHERE user_account_id=p_actor_user_account_id AND status_code='ACTIVE';
  IF v_party IS NULL OR NOT EXISTS(SELECT 1 FROM governance.user_role_assignments ura JOIN governance.roles r ON r.role_id=ura.role_id WHERE ura.user_account_id=p_actor_user_account_id AND ura.status_code='ACTIVE' AND ura.valid_from<=clock_timestamp() AND (ura.valid_to IS NULL OR ura.valid_to>clock_timestamp()) AND r.role_code='PLATFORM_ADMIN') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Platform administrator role is required'; END IF;
  v_hash:=encode(digest(concat_ws('|',p_command_code,p_rollout_plan_id::text,coalesce(p_target_percentage::text,''),btrim(p_reason)),'sha256'),'hex');
  SELECT * INTO v_existing FROM delivery.workflow_operations_command_receipts WHERE idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.request_hash<>v_hash THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Idempotency key was reused with a different request'; END IF;
    RETURN coalesce(v_existing.result_payload,jsonb_build_object('status',v_existing.status_code));
  END IF;
  INSERT INTO delivery.workflow_operations_command_receipts(idempotency_key,command_code,rollout_plan_id,actor_user_account_id,request_hash,reason,status_code,correlation_id)
  VALUES(p_idempotency_key,p_command_code,p_rollout_plan_id,p_actor_user_account_id,v_hash,btrim(p_reason),'RECEIVED',p_correlation_id)
  RETURNING workflow_operations_command_receipt_id INTO v_receipt;
  INSERT INTO governance.approval_requests(approval_code,request_type_code,resource_type,resource_id,requested_action_code,requested_by_party_id,request_reason,risk_level_code,minimum_approvals,status_code,expires_at)
  VALUES('OPS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,18)),'WORKFLOW_OPERATION','WORKFLOW_ROLLOUT',p_rollout_plan_id,p_command_code,v_party,btrim(p_reason),CASE WHEN p_command_code='REQUEST_PROMOTION' THEN 'CRITICAL' ELSE 'HIGH' END,1,'PENDING',clock_timestamp()+interval '30 minutes')
  RETURNING approval_request_id INTO v_approval;
  INSERT INTO delivery.workflow_operations_approval_links(approval_request_id,workflow_operations_command_receipt_id,target_percentage) VALUES(v_approval,v_receipt,p_target_percentage);
  UPDATE delivery.workflow_operations_command_receipts SET result_payload=jsonb_build_object('status','PENDING_APPROVAL','approvalRequestId',v_approval,'expiresInMinutes',30),completed_at=clock_timestamp() WHERE workflow_operations_command_receipt_id=v_receipt;
  RETURN jsonb_build_object('status','PENDING_APPROVAL','approvalRequestId',v_approval,'expiresInMinutes',30);
END $$;

CREATE OR REPLACE FUNCTION delivery.decide_workflow_operations_approval(
 p_approval_request_id uuid,p_approver_user_account_id uuid,p_decision_code varchar,
 p_reason text,p_step_up_verified boolean,p_correlation_id varchar DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,delivery,governance,iam AS $$
DECLARE v_party uuid; v_req governance.approval_requests%ROWTYPE; v_link delivery.workflow_operations_approval_links%ROWTYPE; v_receipt delivery.workflow_operations_command_receipts%ROWTYPE; v_result jsonb;
BEGIN
 IF p_decision_code NOT IN('APPROVE','REJECT') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unsupported approval decision'; END IF;
 IF NOT p_step_up_verified THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Trusted step-up verification is required'; END IF;
 SELECT party_id INTO v_party FROM iam.user_accounts WHERE user_account_id=p_approver_user_account_id AND status_code='ACTIVE';
 IF v_party IS NULL OR NOT EXISTS(SELECT 1 FROM governance.user_role_assignments ura JOIN governance.roles r ON r.role_id=ura.role_id WHERE ura.user_account_id=p_approver_user_account_id AND ura.status_code='ACTIVE' AND ura.valid_from<=clock_timestamp() AND (ura.valid_to IS NULL OR ura.valid_to>clock_timestamp()) AND r.role_code='PLATFORM_ADMIN') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Independent platform administrator is required'; END IF;
 SELECT * INTO v_req FROM governance.approval_requests WHERE approval_request_id=p_approval_request_id FOR UPDATE;
 SELECT * INTO v_link FROM delivery.workflow_operations_approval_links WHERE approval_request_id=p_approval_request_id FOR UPDATE;
 SELECT * INTO v_receipt FROM delivery.workflow_operations_command_receipts WHERE workflow_operations_command_receipt_id=v_link.workflow_operations_command_receipt_id FOR UPDATE;
 IF v_req.status_code<>'PENDING' OR v_link.execution_status_code<>'AWAITING_DECISION' THEN RETURN jsonb_build_object('status','REJECTED','code','APPROVAL_NOT_PENDING'); END IF;
 IF v_req.expires_at<=clock_timestamp() THEN UPDATE governance.approval_requests SET status_code='EXPIRED',decided_at=clock_timestamp() WHERE approval_request_id=p_approval_request_id; UPDATE delivery.workflow_operations_approval_links SET execution_status_code='EXPIRED' WHERE approval_request_id=p_approval_request_id; RETURN jsonb_build_object('status','EXPIRED'); END IF;
 INSERT INTO governance.approval_decisions(approval_request_id,approver_party_id,decision_code,decision_reason) VALUES(p_approval_request_id,v_party,p_decision_code,nullif(btrim(p_reason),''));
 IF p_decision_code='REJECT' THEN UPDATE governance.approval_requests SET status_code='REJECTED',decided_at=clock_timestamp() WHERE approval_request_id=p_approval_request_id; UPDATE delivery.workflow_operations_approval_links SET execution_status_code='REJECTED' WHERE approval_request_id=p_approval_request_id; UPDATE delivery.workflow_operations_command_receipts SET status_code='REJECTED',result_payload=jsonb_build_object('status','REJECTED','code','SECOND_APPROVER_REJECTED') WHERE workflow_operations_command_receipt_id=v_receipt.workflow_operations_command_receipt_id; RETURN jsonb_build_object('status','REJECTED'); END IF;
 UPDATE governance.approval_requests SET status_code='APPROVED',decided_at=clock_timestamp() WHERE approval_request_id=p_approval_request_id;
 IF v_receipt.command_code='PAUSE_ROLLOUT' THEN v_result:=delivery.apply_service_workflow_rollout_action(v_receipt.rollout_plan_id,p_approver_user_account_id,'PAUSE',v_receipt.reason,NULL,true,p_correlation_id); ELSE v_result:=delivery.apply_service_workflow_rollout_action(v_receipt.rollout_plan_id,p_approver_user_account_id,'PROMOTE',v_receipt.reason,v_link.target_percentage,true,p_correlation_id); END IF;
 UPDATE delivery.workflow_operations_approval_links SET execution_status_code=CASE WHEN v_result->>'status'='REJECTED' THEN 'EXECUTION_FAILED' ELSE 'EXECUTED' END,executed_by_party_id=v_party,executed_at=clock_timestamp(),execution_result=v_result WHERE approval_request_id=p_approval_request_id;
 UPDATE delivery.workflow_operations_command_receipts SET status_code=CASE WHEN v_result->>'status'='REJECTED' THEN 'FAILED' ELSE 'SUCCEEDED' END,result_payload=v_result,completed_at=clock_timestamp() WHERE workflow_operations_command_receipt_id=v_receipt.workflow_operations_command_receipt_id;
 RETURN v_result;
END $$;

CREATE VIEW delivery.v_pending_workflow_operations_approvals AS
SELECT ar.approval_request_id,ar.approval_code,ar.requested_action_code,ar.request_reason,ar.risk_level_code,ar.requested_by_party_id,ar.created_at,ar.expires_at,r.rollout_plan_id,l.target_percentage
FROM governance.approval_requests ar JOIN delivery.workflow_operations_approval_links l ON l.approval_request_id=ar.approval_request_id JOIN delivery.workflow_operations_command_receipts r ON r.workflow_operations_command_receipt_id=l.workflow_operations_command_receipt_id
WHERE ar.status_code='PENDING' AND l.execution_status_code='AWAITING_DECISION';

CREATE OR REPLACE FUNCTION delivery.get_pending_workflow_operations_approvals()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,delivery AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'approvalRequestId',approval_request_id,'code',approval_code,
    'action',requested_action_code,'risk',risk_level_code,
    'expiresAt',expires_at,'targetPercentage',target_percentage
  ) ORDER BY created_at),'[]'::jsonb)
  FROM delivery.v_pending_workflow_operations_approvals
  WHERE expires_at>clock_timestamp()
$$;

COMMIT;
