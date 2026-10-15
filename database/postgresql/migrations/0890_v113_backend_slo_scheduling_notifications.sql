BEGIN;

INSERT INTO integration.scheduled_job_definitions(job_code,description,schedule_expression,timezone_name,maximum_attempts,stale_after_minutes)
VALUES('COMMUNICATION_DELIVERY_SLO','Daily delivery SLO measurement and incident notification','0 3 * * *','Asia/Muscat',3,30) ON CONFLICT(job_code) DO NOTHING;

CREATE TABLE communication.delivery_incident_notification_links(
 delivery_operations_incident_id uuid NOT NULL REFERENCES communication.delivery_operations_incidents(delivery_operations_incident_id) ON DELETE RESTRICT,
 outbound_message_id uuid NOT NULL REFERENCES communication.outbound_messages(outbound_message_id) ON DELETE RESTRICT,
 recipient_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(delivery_operations_incident_id,recipient_party_id)
);

CREATE OR REPLACE FUNCTION communication.queue_delivery_incident_notifications(p_actor_party_id uuid,p_user_account_id uuid,p_correlation_id varchar DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,communication,governance,iam AS $$
DECLARE v_topic uuid;v_template uuid;v record;v_message uuid;v_count integer:=0;
BEGIN
 INSERT INTO communication.notification_topics(topic_code,name_ar,category_code,obligation_code,default_priority_code,allowed_channels,owner_party_id,status_code)
 VALUES('DELIVERY_OPERATIONS_INCIDENT','حادث في عمليات تسليم الإشعارات','PLATFORM','MANDATORY','URGENT','["IN_APP"]'::jsonb,p_actor_party_id,'ACTIVE')
 ON CONFLICT(topic_code) DO UPDATE SET status_code='ACTIVE' RETURNING notification_topic_id INTO v_topic;
 INSERT INTO communication.message_templates(notification_topic_id,template_code,version_number,channel_code,language_code,subject_template,body_template,required_variables,sensitivity_code,approved_by_party_id,approved_at,status_code)
 VALUES(v_topic,'DELIVERY_OPERATIONS_INCIDENT',1,'IN_APP','ar','حادث في تسليم إشعارات المنصة','تم اكتشاف خرق في هدف اعتمادية تسليم الإشعارات. راجع لوحة عمليات التسليم.','["severityCode","incidentId"]'::jsonb,'INTERNAL',p_actor_party_id,clock_timestamp(),'ACTIVE')
 ON CONFLICT(template_code,version_number,channel_code,language_code) DO UPDATE SET status_code='ACTIVE' RETURNING message_template_id INTO v_template;
 FOR v IN
  WITH recipients AS(SELECT DISTINCT u.party_id FROM governance.user_role_assignments a JOIN governance.roles r USING(role_id) JOIN iam.user_accounts u USING(user_account_id) WHERE r.role_code='PLATFORM_ADMIN' AND a.status_code='ACTIVE' AND a.valid_from<=clock_timestamp() AND (a.valid_to IS NULL OR a.valid_to>clock_timestamp()) AND u.status_code='ACTIVE' UNION SELECT p_actor_party_id WHERE NOT EXISTS(SELECT 1 FROM governance.user_role_assignments a JOIN governance.roles r USING(role_id) WHERE r.role_code='PLATFORM_ADMIN' AND a.status_code='ACTIVE'))
  SELECT i.delivery_operations_incident_id,i.severity_code,x.party_id FROM communication.delivery_operations_incidents i CROSS JOIN recipients x LEFT JOIN communication.delivery_incident_notification_links l ON l.delivery_operations_incident_id=i.delivery_operations_incident_id AND l.recipient_party_id=x.party_id WHERE i.status_code IN('OPEN','ACKNOWLEDGED') AND l.delivery_operations_incident_id IS NULL
 LOOP
  INSERT INTO communication.outbound_messages(notification_topic_id,message_template_id,recipient_party_id,resource_type,resource_id,channel_code,priority_code,idempotency_key,encrypted_payload_reference,payload_hash,expires_at,status_code)
  VALUES(v_topic,v_template,v.party_id,'delivery_operations_incident',v.delivery_operations_incident_id,'IN_APP','URGENT','delivery-incident:'||v.delivery_operations_incident_id::text||':'||v.party_id::text,'db://communication/delivery_operations_incidents/'||v.delivery_operations_incident_id::text,encode(digest(convert_to(v.delivery_operations_incident_id::text||v.severity_code,'UTF8'),'sha256'),'hex')::char(64),clock_timestamp()+interval '30 days','DELIVERED') RETURNING outbound_message_id INTO v_message;
  INSERT INTO communication.delivery_attempts(outbound_message_id,attempt_number,provider_code,outcome_code,delivered_at) VALUES(v_message,1,'EIM_IN_APP','DELIVERED',clock_timestamp());
  INSERT INTO communication.delivery_incident_notification_links VALUES(v.delivery_operations_incident_id,v_message,v.party_id,clock_timestamp());v_count:=v_count+1;
 END LOOP;RETURN v_count;
END;$$;

CREATE OR REPLACE FUNCTION integration.run_delivery_slo_job(p_actor_party_id uuid,p_user_account_id uuid,p_scheduled_for_date date DEFAULT CURRENT_DATE,p_correlation_id varchar DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,integration,communication,governance AS $$
DECLARE v_def integration.scheduled_job_definitions%ROWTYPE;v_previous integration.scheduled_job_runs%ROWTYPE;v_run uuid;v_attempt integer;v_result jsonb;v_notifications integer;v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO v_def FROM integration.scheduled_job_definitions WHERE job_code='COMMUNICATION_DELIVERY_SLO' FOR UPDATE;
 IF NOT FOUND OR NOT v_def.is_enabled THEN RETURN jsonb_build_object('statusCode','SKIPPED','reason','JOB_DISABLED');END IF;
 IF NOT pg_try_advisory_xact_lock(hashtext('EIM:COMMUNICATION_DELIVERY_SLO')) THEN RETURN jsonb_build_object('statusCode','SKIPPED','reason','CONCURRENT_RUN');END IF;
 SELECT * INTO v_previous FROM integration.scheduled_job_runs WHERE job_code=v_def.job_code AND scheduled_for_date=p_scheduled_for_date ORDER BY attempt_no DESC LIMIT 1 FOR UPDATE;
 IF FOUND AND v_previous.status_code='SUCCEEDED' THEN RETURN jsonb_build_object('scheduledJobRunId',v_previous.scheduled_job_run_id,'statusCode','SKIPPED','reason','ALREADY_SUCCEEDED','resultSummary',v_previous.result_summary);END IF;
 v_attempt:=CASE WHEN FOUND THEN v_previous.attempt_no+1 ELSE 1 END;IF v_attempt>v_def.maximum_attempts THEN RETURN jsonb_build_object('statusCode','SKIPPED','reason','MAXIMUM_ATTEMPTS_REACHED');END IF;
 INSERT INTO integration.scheduled_job_runs(job_code,scheduled_for_date,attempt_no,status_code,requested_by_party_id,user_account_id,correlation_id) VALUES(v_def.job_code,p_scheduled_for_date,v_attempt,'RUNNING',p_actor_party_id,p_user_account_id,p_correlation_id) RETURNING scheduled_job_run_id INTO v_run;
 BEGIN
  v_result:=communication.evaluate_delivery_slos(p_actor_party_id,p_user_account_id,p_scheduled_for_date::timestamptz+interval '23 hours 59 minutes',p_correlation_id);v_notifications:=communication.queue_delivery_incident_notifications(p_actor_party_id,p_user_account_id,p_correlation_id);v_result:=v_result||jsonb_build_object('notificationsCreated',v_notifications);
  UPDATE integration.scheduled_job_runs SET status_code='SUCCEEDED',heartbeat_at=clock_timestamp(),finished_at=clock_timestamp(),result_summary=v_result WHERE scheduled_job_run_id=v_run;
  RETURN jsonb_build_object('scheduledJobRunId',v_run,'statusCode','SUCCEEDED','attemptNo',v_attempt,'resultSummary',v_result);
 EXCEPTION WHEN OTHERS THEN UPDATE integration.scheduled_job_runs SET status_code='FAILED',finished_at=clock_timestamp(),error_code=SQLSTATE,error_message=left(SQLERRM,2000) WHERE scheduled_job_run_id=v_run;RETURN jsonb_build_object('scheduledJobRunId',v_run,'statusCode','FAILED','errorCode',SQLSTATE);END;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0890_v113_backend_slo_scheduling_notifications') ON CONFLICT DO NOTHING;
COMMIT;
