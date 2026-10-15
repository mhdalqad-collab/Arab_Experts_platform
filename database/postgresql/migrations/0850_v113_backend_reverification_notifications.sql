BEGIN;

ALTER TABLE professional.publication_reverification_alerts
 ADD COLUMN acknowledged_at timestamptz,
 ADD COLUMN acknowledged_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT;

CREATE TABLE professional.publication_reverification_notification_links(
 publication_reverification_alert_id uuid NOT NULL REFERENCES professional.publication_reverification_alerts(publication_reverification_alert_id) ON DELETE RESTRICT,
 outbound_message_id uuid NOT NULL REFERENCES communication.outbound_messages(outbound_message_id) ON DELETE RESTRICT,
 escalation_level integer NOT NULL CHECK(escalation_level BETWEEN 1 AND 3),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(publication_reverification_alert_id,outbound_message_id)
);

CREATE OR REPLACE FUNCTION professional.queue_publication_reverification_notifications(p_actor_party_id uuid,p_user_account_id uuid,p_as_of_date date DEFAULT CURRENT_DATE,p_correlation_id varchar DEFAULT NULL)
RETURNS TABLE(messages_created integer,in_app_delivered integer,escalations_created integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,communication,governance AS $$
DECLARE
 v_topic_id uuid;v_template_id uuid;v record;v_message_id uuid;v_level integer;v_priority varchar(12);v_created integer:=0;v_delivered integer:=0;v_escalated integer:=0;
BEGIN
 INSERT INTO communication.notification_topics(topic_code,name_ar,category_code,obligation_code,default_priority_code,allowed_channels,owner_party_id,status_code)
 VALUES('PROFESSIONAL_REVERIFICATION','إعادة التحقق من الأدلة المهنية','ACCOUNT','MANDATORY','HIGH','["IN_APP","EMAIL"]'::jsonb,p_actor_party_id,'ACTIVE')
 ON CONFLICT(topic_code) DO UPDATE SET status_code='ACTIVE' RETURNING notification_topic_id INTO v_topic_id;
 INSERT INTO communication.message_templates(notification_topic_id,template_code,version_number,channel_code,language_code,subject_template,body_template,required_variables,sensitivity_code,approved_by_party_id,approved_at,status_code)
 VALUES
 (v_topic_id,'PROFESSIONAL_REVERIFICATION_ALERT',1,'IN_APP','ar','إجراء مطلوب لإعادة التحقق','توجد أدلة مهنية منشورة تتطلب المراجعة أو إعادة التحقق. راجع لوحة ملفك المهني.','["alertType","dueDate"]'::jsonb,'CONFIDENTIAL',p_actor_party_id,clock_timestamp(),'ACTIVE'),
 (v_topic_id,'PROFESSIONAL_REVERIFICATION_ALERT',1,'EMAIL','ar','إجراء مطلوب لإعادة التحقق','توجد أدلة مهنية منشورة تتطلب المراجعة أو إعادة التحقق. يرجى تسجيل الدخول إلى المنصة.','["alertType","dueDate"]'::jsonb,'CONFIDENTIAL',p_actor_party_id,clock_timestamp(),'ACTIVE')
 ON CONFLICT(template_code,version_number,channel_code,language_code) DO UPDATE SET status_code='ACTIVE';
 FOR v IN
  SELECT a.*,c.channel_code FROM professional.publication_reverification_alerts a
  CROSS JOIN LATERAL (SELECT 'IN_APP'::varchar AS channel_code UNION SELECT p.channel_code FROM communication.notification_preferences p WHERE p.party_id=a.recipient_party_id AND p.notification_topic_id=v_topic_id AND p.enabled AND p.channel_code IN('IN_APP','EMAIL') AND p.effective_from<=clock_timestamp() AND (p.effective_to IS NULL OR p.effective_to>clock_timestamp())) c
  WHERE a.status_code='OPEN' AND a.acknowledged_at IS NULL
 LOOP
  v_level:=CASE WHEN v.alert_type_code='PUBLICATION_AUTO_SUSPENDED' OR v.due_date<p_as_of_date THEN 2 ELSE 1 END;
  v_priority:=CASE WHEN v_level=2 THEN 'URGENT' ELSE 'HIGH' END;
  SELECT message_template_id INTO v_template_id FROM communication.message_templates WHERE notification_topic_id=v_topic_id AND template_code='PROFESSIONAL_REVERIFICATION_ALERT' AND channel_code=v.channel_code AND language_code='ar' AND status_code='ACTIVE' ORDER BY version_number DESC LIMIT 1;
  INSERT INTO communication.outbound_messages(notification_topic_id,message_template_id,recipient_party_id,resource_type,resource_id,channel_code,priority_code,idempotency_key,encrypted_payload_reference,payload_hash,expires_at,status_code)
  VALUES(v_topic_id,v_template_id,v.recipient_party_id,'publication_reverification_alert',v.publication_reverification_alert_id,v.channel_code,v_priority,'reverification:'||v.publication_reverification_alert_id::text||':'||v.channel_code||':L'||v_level,'db://professional/publication_reverification_alerts/'||v.publication_reverification_alert_id::text,encode(digest(convert_to(jsonb_build_object('alertType',v.alert_type_code,'dueDate',v.due_date,'level',v_level)::text,'UTF8'),'sha256'),'hex')::char(64),clock_timestamp()+interval '30 days',CASE WHEN v.channel_code='IN_APP' THEN 'DELIVERED' ELSE 'QUEUED' END)
  ON CONFLICT(idempotency_key) DO NOTHING RETURNING outbound_message_id INTO v_message_id;
  IF v_message_id IS NOT NULL THEN
   INSERT INTO professional.publication_reverification_notification_links VALUES(v.publication_reverification_alert_id,v_message_id,v_level,clock_timestamp());
   v_created:=v_created+1;IF v_level>1 THEN v_escalated:=v_escalated+1;END IF;
   IF v.channel_code='IN_APP' THEN INSERT INTO communication.delivery_attempts(outbound_message_id,attempt_number,provider_code,outcome_code,delivered_at) VALUES(v_message_id,1,'EIM_IN_APP','DELIVERED',clock_timestamp());v_delivered:=v_delivered+1;END IF;
  END IF;
  v_message_id:=NULL;
 END LOOP;
 PERFORM governance.append_audit_event('COMMUNICATION','REVERIFICATION_NOTIFICATIONS_QUEUED',p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','publication_reverification_notification_batch',NULL,p_correlation_id,'SUCCESS','HIGH','QUEUED',jsonb_build_object('as_of_date',p_as_of_date,'messages_created',v_created,'in_app_delivered',v_delivered,'escalations_created',v_escalated));
 RETURN QUERY SELECT v_created,v_delivered,v_escalated;
END;$$;

ALTER FUNCTION professional.evaluate_publication_reverification(uuid,uuid,date,varchar) RENAME TO evaluate_publication_reverification_pre0850;
CREATE OR REPLACE FUNCTION professional.evaluate_publication_reverification(p_actor_party_id uuid,p_user_account_id uuid,p_as_of_date date DEFAULT CURRENT_DATE,p_correlation_id varchar DEFAULT NULL)
RETURNS TABLE(assessed_count integer,alerts_created integer,suspended_count integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,communication,governance AS $$
DECLARE v_assessed integer;v_alerts integer;v_suspended integer;
BEGIN
 SELECT x.assessed_count,x.alerts_created,x.suspended_count INTO v_assessed,v_alerts,v_suspended FROM professional.evaluate_publication_reverification_pre0850(p_actor_party_id,p_user_account_id,p_as_of_date,p_correlation_id) x;
 PERFORM * FROM professional.queue_publication_reverification_notifications(p_actor_party_id,p_user_account_id,p_as_of_date,p_correlation_id);
 RETURN QUERY SELECT v_assessed,v_alerts,v_suspended;
END;$$;

CREATE OR REPLACE FUNCTION professional.acknowledge_publication_reverification_alert(p_alert_id uuid,p_party_id uuid,p_user_account_id uuid,p_correlation_id varchar DEFAULT NULL) RETURNS timestamptz
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE v_at timestamptz:=clock_timestamp();
BEGIN
 UPDATE professional.publication_reverification_alerts SET acknowledged_at=coalesce(acknowledged_at,v_at),acknowledged_by_party_id=coalesce(acknowledged_by_party_id,p_party_id) WHERE publication_reverification_alert_id=p_alert_id AND recipient_party_id=p_party_id RETURNING acknowledged_at INTO v_at;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Reverification alert not found';END IF;
 PERFORM governance.append_audit_event('PROFESSIONAL','REVERIFICATION_ALERT_ACKNOWLEDGED',p_party_id,p_user_account_id,'MEMBER_SELF','publication_reverification_alert',p_alert_id,p_correlation_id,'SUCCESS','NORMAL','ACKNOWLEDGED','{}'::jsonb);RETURN v_at;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0850_v113_backend_reverification_notifications') ON CONFLICT DO NOTHING;
COMMIT;
