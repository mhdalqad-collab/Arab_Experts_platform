BEGIN;

ALTER TABLE communication.outbound_messages
 ADD COLUMN lease_token_hash char(64),
 ADD COLUMN lease_expires_at timestamptz,
 ADD COLUMN claimed_at timestamptz,
 ADD COLUMN claim_count integer NOT NULL DEFAULT 0 CHECK(claim_count BETWEEN 0 AND 20);
CREATE INDEX idx_outbound_dispatch_claim ON communication.outbound_messages(status_code,scheduled_at) WHERE channel_code<>'IN_APP';

CREATE OR REPLACE FUNCTION communication.claim_outbound_messages(p_provider_code varchar,p_batch_size integer DEFAULT 25)
RETURNS TABLE(outbound_message_id uuid,lease_token varchar,channel_code varchar,recipient_endpoint text,subject_text text,body_text text,payload_reference text,expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,communication,iam AS $$
DECLARE v_token varchar;
BEGIN
 IF nullif(btrim(p_provider_code),'') IS NULL OR p_batch_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid provider and bounded batch size are required';END IF;
 UPDATE communication.outbound_messages m SET status_code=CASE WHEN m.claim_count>=5 THEN 'FAILED' ELSE 'QUEUED' END,lease_token_hash=NULL,lease_expires_at=NULL
 WHERE m.status_code='SENDING' AND m.lease_expires_at<=clock_timestamp();
 v_token:=encode(gen_random_bytes(32),'hex');
 RETURN QUERY
 WITH candidates AS(
  SELECT m.outbound_message_id FROM communication.outbound_messages m
  JOIN communication.v_message_delivery_readiness r USING(outbound_message_id)
  JOIN iam.user_accounts u ON u.party_id=m.recipient_party_id AND u.status_code='ACTIVE'
  WHERE m.channel_code<>'IN_APP' AND m.status_code IN('QUEUED','DEFERRED') AND m.scheduled_at<=clock_timestamp() AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp()) AND m.claim_count<5 AND r.readiness_code='READY_TO_DISPATCH'
  ORDER BY m.priority_code DESC,m.scheduled_at,m.created_at FOR UPDATE OF m SKIP LOCKED LIMIT p_batch_size
 ),claimed AS(
  UPDATE communication.outbound_messages m SET status_code='SENDING',lease_token_hash=encode(digest(convert_to(v_token||m.outbound_message_id::text,'UTF8'),'sha256'),'hex')::char(64),lease_expires_at=clock_timestamp()+interval '2 minutes',claimed_at=clock_timestamp(),claim_count=claim_count+1 FROM candidates c WHERE m.outbound_message_id=c.outbound_message_id RETURNING m.*
 )
 SELECT c.outbound_message_id,v_token,c.channel_code,u.primary_email::text,t.subject_template,t.body_template,c.encrypted_payload_reference,c.expires_at
 FROM claimed c JOIN iam.user_accounts u ON u.party_id=c.recipient_party_id AND u.status_code='ACTIVE' JOIN communication.message_templates t USING(message_template_id);
END;$$;

CREATE OR REPLACE FUNCTION communication.record_outbound_delivery_result(p_message_id uuid,p_lease_token varchar,p_provider_code varchar,p_outcome_code varchar,p_provider_reference text DEFAULT NULL,p_response_code varchar DEFAULT NULL,p_correlation_id varchar DEFAULT NULL)
RETURNS varchar LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,communication,governance,iam AS $$
DECLARE v communication.outbound_messages%ROWTYPE;v_attempt integer;v_outcome varchar:=upper(btrim(p_outcome_code));v_status varchar;v_retry timestamptz;v_endpoint_hash char(64);
BEGIN
 IF p_lease_token !~ '^[0-9a-f]{64}$' OR v_outcome NOT IN('ACCEPTED','DELIVERED','TEMPORARY_FAILURE','PERMANENT_FAILURE','BOUNCED','REJECTED','RATE_LIMITED') OR nullif(btrim(p_provider_code),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid delivery result is required';END IF;
 SELECT * INTO v FROM communication.outbound_messages WHERE outbound_message_id=p_message_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Outbound message not found';END IF;
 IF v.status_code<>'SENDING' OR v.lease_expires_at<=clock_timestamp() OR v.lease_token_hash<>encode(digest(convert_to(p_lease_token||p_message_id::text,'UTF8'),'sha256'),'hex')::char(64) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Delivery lease is invalid or expired';END IF;
 SELECT coalesce(max(attempt_number),0)+1 INTO v_attempt FROM communication.delivery_attempts WHERE outbound_message_id=p_message_id;
 v_retry:=CASE WHEN v_outcome IN('TEMPORARY_FAILURE','RATE_LIMITED') THEN clock_timestamp()+make_interval(mins=>least(60,power(2,v_attempt)::integer)) END;
 INSERT INTO communication.delivery_attempts(outbound_message_id,attempt_number,provider_code,provider_message_reference,outcome_code,response_code,next_retry_at,delivered_at)
 VALUES(p_message_id,v_attempt,btrim(p_provider_code),p_provider_reference,v_outcome,p_response_code,v_retry,CASE WHEN v_outcome='DELIVERED' THEN clock_timestamp() END);
 v_status:=CASE v_outcome WHEN 'ACCEPTED' THEN 'SENT' WHEN 'DELIVERED' THEN 'DELIVERED' WHEN 'TEMPORARY_FAILURE' THEN 'DEFERRED' WHEN 'RATE_LIMITED' THEN 'DEFERRED' ELSE 'FAILED' END;
 UPDATE communication.outbound_messages SET status_code=v_status,scheduled_at=coalesce(v_retry,scheduled_at),lease_token_hash=NULL,lease_expires_at=NULL WHERE outbound_message_id=p_message_id;
 IF v_outcome='BOUNCED' AND v.channel_code='EMAIL' THEN
  SELECT encode(digest(convert_to(lower(u.primary_email::text),'UTF8'),'sha256'),'hex')::char(64) INTO v_endpoint_hash FROM iam.user_accounts u WHERE u.party_id=v.recipient_party_id AND u.status_code='ACTIVE' LIMIT 1;
  IF v_endpoint_hash IS NOT NULL AND NOT EXISTS(SELECT 1 FROM communication.contact_suppressions s WHERE s.party_id=v.recipient_party_id AND s.channel_code='EMAIL' AND s.contact_endpoint_hash=v_endpoint_hash AND (s.effective_to IS NULL OR s.effective_to>clock_timestamp())) THEN INSERT INTO communication.contact_suppressions(party_id,channel_code,contact_endpoint_hash,reason_code,scope_code,created_by_party_id,evidence_reference) VALUES(v.recipient_party_id,'EMAIL',v_endpoint_hash,'HARD_BOUNCE','ALL',NULL,coalesce(p_provider_reference,p_response_code,'provider-bounce'));END IF;
 END IF;
 RETURN v_status;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0860_v113_backend_outbound_dispatcher') ON CONFLICT DO NOTHING;
COMMIT;
