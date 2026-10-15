BEGIN;

CREATE TABLE communication.delivery_slo_policies(
 delivery_slo_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 policy_code varchar(60) NOT NULL UNIQUE,
 channel_code varchar(16) NOT NULL CHECK(channel_code IN('EMAIL','SMS','WHATSAPP','PUSH')),
 window_hours integer NOT NULL CHECK(window_hours BETWEEN 1 AND 720),
 target_success_percent numeric(6,3) NOT NULL CHECK(target_success_percent BETWEEN 0 AND 100),
 maximum_open_dead_letters integer NOT NULL CHECK(maximum_open_dead_letters BETWEEN 0 AND 10000),
 minimum_terminal_events integer NOT NULL CHECK(minimum_terminal_events BETWEEN 1 AND 100000),
 status_code varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK(status_code IN('ACTIVE','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO communication.delivery_slo_policies(policy_code,channel_code,window_hours,target_success_percent,maximum_open_dead_letters,minimum_terminal_events)
VALUES('EMAIL_DELIVERY_24H','EMAIL',24,95,0,10) ON CONFLICT(policy_code) DO NOTHING;

CREATE TABLE communication.delivery_slo_measurements(
 delivery_slo_measurement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 delivery_slo_policy_id uuid NOT NULL REFERENCES communication.delivery_slo_policies(delivery_slo_policy_id) ON DELETE RESTRICT,
 window_started_at timestamptz NOT NULL,
 window_ended_at timestamptz NOT NULL,
 terminal_message_count integer NOT NULL CHECK(terminal_message_count>=0),
 delivered_message_count integer NOT NULL CHECK(delivered_message_count>=0),
 success_percent numeric(6,3),
 open_dead_letter_count integer NOT NULL CHECK(open_dead_letter_count>=0),
 compliance_code varchar(20) NOT NULL CHECK(compliance_code IN('MET','AT_RISK','BREACHED','INSUFFICIENT_DATA')),
 measured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(delivery_slo_policy_id,window_started_at,window_ended_at)
);

CREATE TABLE communication.delivery_operations_incidents(
 delivery_operations_incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 delivery_slo_policy_id uuid NOT NULL REFERENCES communication.delivery_slo_policies(delivery_slo_policy_id) ON DELETE RESTRICT,
 opened_from_measurement_id uuid NOT NULL REFERENCES communication.delivery_slo_measurements(delivery_slo_measurement_id) ON DELETE RESTRICT,
 severity_code varchar(12) NOT NULL CHECK(severity_code IN('HIGH','CRITICAL')),
 status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(status_code IN('OPEN','ACKNOWLEDGED','RESOLVED')),
 summary text NOT NULL,
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 acknowledged_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 acknowledged_at timestamptz,
 resolved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 resolution_reason text CHECK(resolution_reason IS NULL OR length(btrim(resolution_reason)) BETWEEN 20 AND 2000),
 resolved_at timestamptz,
 correlation_id varchar(120)
);
CREATE UNIQUE INDEX uq_active_delivery_slo_incident ON communication.delivery_operations_incidents(delivery_slo_policy_id) WHERE status_code IN('OPEN','ACKNOWLEDGED');

CREATE OR REPLACE FUNCTION communication.evaluate_delivery_slos(p_actor_party_id uuid,p_user_account_id uuid,p_window_end timestamptz DEFAULT clock_timestamp(),p_correlation_id varchar DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,communication,governance AS $$
DECLARE v_policy communication.delivery_slo_policies%ROWTYPE;v_start timestamptz;v_total integer;v_delivered integer;v_dead integer;v_rate numeric;v_compliance varchar;v_measurement uuid;v_measured integer:=0;v_breached integer:=0;v_incidents integer:=0;
BEGIN
 FOR v_policy IN SELECT * FROM communication.delivery_slo_policies WHERE status_code='ACTIVE' LOOP
  v_start:=p_window_end-make_interval(hours=>v_policy.window_hours);
  SELECT count(*)::int,count(*) FILTER(WHERE m.status_code='DELIVERED')::int INTO v_total,v_delivered FROM communication.outbound_messages m WHERE m.channel_code=v_policy.channel_code AND m.created_at>=v_start AND m.created_at<p_window_end AND m.status_code IN('DELIVERED','FAILED');
  SELECT count(*)::int INTO v_dead FROM communication.dead_letter_messages d JOIN communication.outbound_messages m USING(outbound_message_id) WHERE m.channel_code=v_policy.channel_code AND d.status_code='OPEN';
  v_rate:=CASE WHEN v_total>0 THEN round(v_delivered::numeric*100/v_total,3) END;
  v_compliance:=CASE WHEN v_total<v_policy.minimum_terminal_events THEN 'INSUFFICIENT_DATA' WHEN v_dead>v_policy.maximum_open_dead_letters OR v_rate<v_policy.target_success_percent THEN 'BREACHED' WHEN v_rate<v_policy.target_success_percent+2 THEN 'AT_RISK' ELSE 'MET' END;
  INSERT INTO communication.delivery_slo_measurements(delivery_slo_policy_id,window_started_at,window_ended_at,terminal_message_count,delivered_message_count,success_percent,open_dead_letter_count,compliance_code)
  VALUES(v_policy.delivery_slo_policy_id,v_start,p_window_end,v_total,v_delivered,v_rate,v_dead,v_compliance) ON CONFLICT(delivery_slo_policy_id,window_started_at,window_ended_at) DO UPDATE SET terminal_message_count=excluded.terminal_message_count,delivered_message_count=excluded.delivered_message_count,success_percent=excluded.success_percent,open_dead_letter_count=excluded.open_dead_letter_count,compliance_code=excluded.compliance_code,measured_at=clock_timestamp() RETURNING delivery_slo_measurement_id INTO v_measurement;
  v_measured:=v_measured+1;
  IF v_compliance='BREACHED' THEN
   v_breached:=v_breached+1;
   INSERT INTO communication.delivery_operations_incidents(delivery_slo_policy_id,opened_from_measurement_id,severity_code,summary,correlation_id)
   VALUES(v_policy.delivery_slo_policy_id,v_measurement,CASE WHEN v_rate<80 OR v_dead>5 THEN 'CRITICAL' ELSE 'HIGH' END,'Delivery SLO breached for channel '||v_policy.channel_code,p_correlation_id) ON CONFLICT DO NOTHING;
   IF FOUND THEN v_incidents:=v_incidents+1;END IF;
  END IF;
 END LOOP;
 PERFORM governance.append_audit_event('COMMUNICATION','DELIVERY_SLO_EVALUATED',p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','delivery_slo_evaluation',NULL,p_correlation_id,'SUCCESS','HIGH','EVALUATED',jsonb_build_object('measured',v_measured,'breached',v_breached,'incidents_created',v_incidents));
 RETURN jsonb_build_object('measuredCount',v_measured,'breachedCount',v_breached,'incidentsCreated',v_incidents);
END;$$;

CREATE OR REPLACE FUNCTION communication.resolve_delivery_operations_incident(p_incident_id uuid,p_actor_party_id uuid,p_user_account_id uuid,p_action varchar,p_reason text,p_correlation_id varchar DEFAULT NULL) RETURNS varchar
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,communication,governance AS $$
DECLARE v communication.delivery_operations_incidents%ROWTYPE;v_action varchar:=upper(btrim(p_action));v_new varchar;
BEGIN
 SELECT * INTO v FROM communication.delivery_operations_incidents WHERE delivery_operations_incident_id=p_incident_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Delivery incident not found';END IF;
 IF v_action NOT IN('ACKNOWLEDGE','RESOLVE') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 20 AND 2000 OR (v_action='ACKNOWLEDGE' AND v.status_code<>'OPEN') OR (v_action='RESOLVE' AND v.status_code NOT IN('OPEN','ACKNOWLEDGED')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valid incident transition and substantive reason are required';END IF;
 v_new:=CASE v_action WHEN 'ACKNOWLEDGE' THEN 'ACKNOWLEDGED' ELSE 'RESOLVED' END;
 UPDATE communication.delivery_operations_incidents SET status_code=v_new,acknowledged_by_party_id=CASE WHEN v_action='ACKNOWLEDGE' THEN p_actor_party_id ELSE acknowledged_by_party_id END,acknowledged_at=CASE WHEN v_action='ACKNOWLEDGE' THEN clock_timestamp() ELSE acknowledged_at END,resolved_by_party_id=CASE WHEN v_action='RESOLVE' THEN p_actor_party_id ELSE NULL END,resolution_reason=CASE WHEN v_action='RESOLVE' THEN btrim(p_reason) ELSE resolution_reason END,resolved_at=CASE WHEN v_action='RESOLVE' THEN clock_timestamp() ELSE NULL END,correlation_id=p_correlation_id WHERE delivery_operations_incident_id=p_incident_id;
 PERFORM governance.append_audit_event('COMMUNICATION','DELIVERY_INCIDENT_'||v_new,p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','delivery_operations_incident',p_incident_id,p_correlation_id,'SUCCESS','CRITICAL',v_new,jsonb_build_object('reason',btrim(p_reason)));RETURN v_new;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0880_v113_backend_delivery_slo_incidents') ON CONFLICT DO NOTHING;
COMMIT;
