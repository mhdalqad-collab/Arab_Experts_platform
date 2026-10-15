BEGIN;

INSERT INTO governance.permissions(permission_code,name_ar,name_en,domain_code,action_code,resource_type,risk_level_code,requires_step_up_auth,requires_reason)
VALUES('communication.delivery.operations','إدارة عمليات تسليم الإشعارات','Manage notification delivery operations','COMMUNICATION','DELIVERY_OPERATIONS','outbound_message','CRITICAL',true,true)
ON CONFLICT(permission_code) DO UPDATE SET is_active=true,requires_step_up_auth=true,requires_reason=true;
INSERT INTO governance.role_permissions(role_id,permission_id,constraint_expression)
SELECT r.role_id,p.permission_id,'{"scope":"platform"}'::jsonb FROM governance.roles r CROSS JOIN governance.permissions p WHERE r.role_code='PLATFORM_ADMIN' AND p.permission_code='communication.delivery.operations'
ON CONFLICT(role_id,permission_id,valid_from) DO NOTHING;

CREATE TABLE communication.dead_letter_messages(
 dead_letter_message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 outbound_message_id uuid NOT NULL UNIQUE REFERENCES communication.outbound_messages(outbound_message_id) ON DELETE RESTRICT,
 failure_reason_code varchar(40) NOT NULL,
 failure_snapshot jsonb NOT NULL,
 status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(status_code IN('OPEN','REQUEUED','DISCARDED')),
 failed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 resolution_reason text CHECK(resolution_reason IS NULL OR length(btrim(resolution_reason)) BETWEEN 20 AND 2000),
 resolved_at timestamptz,
 correlation_id varchar(120)
);
CREATE INDEX idx_dead_letter_open ON communication.dead_letter_messages(status_code,failed_at DESC);

CREATE OR REPLACE FUNCTION communication.capture_dead_letter_message() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,communication AS $$
DECLARE v_reason varchar;
BEGIN
 IF NEW.status_code='FAILED' AND OLD.status_code IS DISTINCT FROM 'FAILED' THEN
  SELECT coalesce(a.outcome_code,'MAXIMUM_ATTEMPTS') INTO v_reason FROM communication.delivery_attempts a WHERE a.outbound_message_id=NEW.outbound_message_id ORDER BY a.attempt_number DESC LIMIT 1;
  INSERT INTO communication.dead_letter_messages(outbound_message_id,failure_reason_code,failure_snapshot)
  VALUES(NEW.outbound_message_id,coalesce(v_reason,'UNKNOWN'),jsonb_build_object('channelCode',NEW.channel_code,'claimCount',NEW.claim_count,'priorityCode',NEW.priority_code,'resourceType',NEW.resource_type,'failedStatus',NEW.status_code)) ON CONFLICT(outbound_message_id) DO NOTHING;
 END IF;RETURN NEW;
END;$$;
CREATE TRIGGER trg_capture_dead_letter_message AFTER UPDATE OF status_code ON communication.outbound_messages FOR EACH ROW EXECUTE FUNCTION communication.capture_dead_letter_message();

CREATE OR REPLACE FUNCTION communication.resolve_dead_letter_message(p_dead_letter_id uuid,p_actor_party_id uuid,p_user_account_id uuid,p_action varchar,p_reason text,p_correlation_id varchar DEFAULT NULL) RETURNS varchar
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,communication,governance AS $$
DECLARE v communication.dead_letter_messages%ROWTYPE;v_message communication.outbound_messages%ROWTYPE;v_action varchar:=upper(btrim(p_action));v_new varchar;
BEGIN
 SELECT * INTO v FROM communication.dead_letter_messages WHERE dead_letter_message_id=p_dead_letter_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Dead-letter message not found';END IF;
 IF v.status_code<>'OPEN' OR v_action NOT IN('REQUEUE','DISCARD') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Open dead letter, controlled action and substantive reason are required';END IF;
 SELECT * INTO v_message FROM communication.outbound_messages WHERE outbound_message_id=v.outbound_message_id FOR UPDATE;
 IF v_action='REQUEUE' THEN
  IF EXISTS(SELECT 1 FROM communication.contact_suppressions s WHERE s.party_id=v_message.recipient_party_id AND s.channel_code=v_message.channel_code AND (s.effective_to IS NULL OR s.effective_to>clock_timestamp()) AND s.scope_code='ALL') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Suppressed contact channel must be remediated before requeue';END IF;
  UPDATE communication.outbound_messages SET status_code='QUEUED',scheduled_at=clock_timestamp(),claim_count=0,lease_token_hash=NULL,lease_expires_at=NULL WHERE outbound_message_id=v.outbound_message_id;v_new:='REQUEUED';
 ELSE UPDATE communication.outbound_messages SET status_code='CANCELLED',lease_token_hash=NULL,lease_expires_at=NULL WHERE outbound_message_id=v.outbound_message_id;v_new:='DISCARDED';END IF;
 UPDATE communication.dead_letter_messages SET status_code=v_new,resolved_by_party_id=p_actor_party_id,resolution_reason=btrim(p_reason),resolved_at=clock_timestamp(),correlation_id=p_correlation_id WHERE dead_letter_message_id=p_dead_letter_id;
 PERFORM governance.append_audit_event('COMMUNICATION','DEAD_LETTER_'||v_new,p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','dead_letter_message',p_dead_letter_id,p_correlation_id,'SUCCESS','CRITICAL',v_new,jsonb_build_object('outbound_message_id',v.outbound_message_id,'failure_reason_code',v.failure_reason_code,'reason',btrim(p_reason)));RETURN v_new;
END;$$;

CREATE VIEW communication.v_delivery_operations_dashboard AS
SELECT
 count(*) FILTER(WHERE m.status_code IN('QUEUED','DEFERRED')) AS pending_count,
 count(*) FILTER(WHERE m.status_code='SENDING') AS sending_count,
 count(*) FILTER(WHERE m.status_code='DELIVERED' AND m.created_at>=clock_timestamp()-interval '24 hours') AS delivered_24h,
 count(*) FILTER(WHERE m.status_code='FAILED' AND m.created_at>=clock_timestamp()-interval '24 hours') AS failed_24h,
 count(*) FILTER(WHERE m.status_code='SENDING' AND m.lease_expires_at<=clock_timestamp()) AS stale_lease_count,
 (SELECT count(*) FROM communication.dead_letter_messages d WHERE d.status_code='OPEN') AS open_dead_letter_count
FROM communication.outbound_messages m;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0870_v113_backend_delivery_dead_letter') ON CONFLICT DO NOTHING;
COMMIT;
