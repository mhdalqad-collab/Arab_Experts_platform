BEGIN;

CREATE TABLE delivery.workflow_operations_incidents (
  workflow_operations_incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_code varchar(40) NOT NULL UNIQUE,
  incident_type_code varchar(32) NOT NULL CHECK (incident_type_code IN (
    'CANARY_THRESHOLD','OUTBOX_DEAD_LETTER','APPROVAL_EXPIRED','ADAPTER_UNREACHABLE','COMMAND_FAILURE'
  )),
  severity_code varchar(12) NOT NULL CHECK (severity_code IN ('SEV1','SEV2','SEV3','SEV4')),
  status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status_code IN (
    'OPEN','ACKNOWLEDGED','INVESTIGATING','MITIGATED','RESOLVED','CLOSED'
  )),
  source_type varchar(60) NOT NULL,
  source_id uuid,
  fingerprint varchar(64) NOT NULL,
  title varchar(240) NOT NULL,
  summary text NOT NULL,
  owner_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  acknowledge_due_at timestamptz NOT NULL,
  resolution_due_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  escalated_at timestamptz,
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count>0),
  last_observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  correlation_id varchar(120),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_open_workflow_operations_incident
  ON delivery.workflow_operations_incidents(fingerprint)
  WHERE status_code NOT IN ('RESOLVED','CLOSED');
CREATE INDEX ix_workflow_operations_incidents_queue
  ON delivery.workflow_operations_incidents(status_code,severity_code,acknowledge_due_at);

CREATE TABLE delivery.workflow_operations_incident_events (
  workflow_operations_incident_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_operations_incident_id uuid NOT NULL REFERENCES delivery.workflow_operations_incidents(workflow_operations_incident_id) ON DELETE CASCADE,
  event_code varchar(24) NOT NULL CHECK (event_code IN (
    'DETECTED','REOBSERVED','ASSIGNED','ACKNOWLEDGED','INVESTIGATION','ESCALATED','MITIGATED','RESOLVED','CLOSED','COMMENT'
  )),
  from_status_code varchar(20),
  to_status_code varchar(20),
  actor_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ix_workflow_operations_incident_events_time
  ON delivery.workflow_operations_incident_events(workflow_operations_incident_id,occurred_at);

CREATE OR REPLACE FUNCTION delivery.raise_workflow_operations_incident(
  p_incident_type_code varchar,p_severity_code varchar,p_source_type varchar,
  p_source_id uuid,p_title varchar,p_summary text,p_correlation_id varchar DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,delivery AS $$
DECLARE v_id uuid; v_fingerprint varchar(64); v_ack interval; v_resolve interval;
BEGIN
  v_fingerprint:=encode(digest(concat_ws('|',p_incident_type_code,p_source_type,coalesce(p_source_id::text,'GLOBAL')),'sha256'),'hex');
  v_ack:=CASE p_severity_code WHEN 'SEV1' THEN interval '15 minutes' WHEN 'SEV2' THEN interval '30 minutes' WHEN 'SEV3' THEN interval '4 hours' ELSE interval '1 day' END;
  v_resolve:=CASE p_severity_code WHEN 'SEV1' THEN interval '4 hours' WHEN 'SEV2' THEN interval '8 hours' WHEN 'SEV3' THEN interval '2 days' ELSE interval '5 days' END;
  SELECT workflow_operations_incident_id INTO v_id FROM delivery.workflow_operations_incidents
    WHERE fingerprint=v_fingerprint AND status_code NOT IN('RESOLVED','CLOSED') FOR UPDATE;
  IF FOUND THEN
    UPDATE delivery.workflow_operations_incidents SET occurrence_count=occurrence_count+1,last_observed_at=clock_timestamp(),summary=p_summary,metadata=coalesce(p_metadata,'{}'::jsonb),updated_at=clock_timestamp() WHERE workflow_operations_incident_id=v_id;
    INSERT INTO delivery.workflow_operations_incident_events(workflow_operations_incident_id,event_code,note,metadata) VALUES(v_id,'REOBSERVED',p_summary,coalesce(p_metadata,'{}'::jsonb));
    RETURN v_id;
  END IF;
  INSERT INTO delivery.workflow_operations_incidents(incident_code,incident_type_code,severity_code,source_type,source_id,fingerprint,title,summary,acknowledge_due_at,resolution_due_at,correlation_id,metadata)
  VALUES('INC-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),p_incident_type_code,p_severity_code,p_source_type,p_source_id,v_fingerprint,p_title,p_summary,clock_timestamp()+v_ack,clock_timestamp()+v_resolve,p_correlation_id,coalesce(p_metadata,'{}'::jsonb))
  RETURNING workflow_operations_incident_id INTO v_id;
  INSERT INTO delivery.workflow_operations_incident_events(workflow_operations_incident_id,event_code,note,metadata) VALUES(v_id,'DETECTED',p_summary,coalesce(p_metadata,'{}'::jsonb));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION delivery.escalate_overdue_workflow_operations_incidents()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public,delivery AS $$
DECLARE v_count integer;
BEGIN
  WITH due AS (
    UPDATE delivery.workflow_operations_incidents SET escalated_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE status_code IN('OPEN','ACKNOWLEDGED','INVESTIGATING') AND escalated_at IS NULL
      AND ((acknowledged_at IS NULL AND acknowledge_due_at<=clock_timestamp()) OR resolution_due_at<=clock_timestamp())
    RETURNING workflow_operations_incident_id
  ), events AS (
    INSERT INTO delivery.workflow_operations_incident_events(workflow_operations_incident_id,event_code,note)
    SELECT workflow_operations_incident_id,'ESCALATED','تم التصعيد آليًا لتجاوز مهلة الاستجابة.' FROM due RETURNING 1
  ) SELECT count(*) INTO v_count FROM events;
  RETURN v_count;
END $$;

CREATE VIEW delivery.v_workflow_operations_incident_queue AS
SELECT workflow_operations_incident_id,incident_code,incident_type_code,severity_code,status_code,title,
  owner_party_id,detected_at,acknowledge_due_at,resolution_due_at,occurrence_count,
  (acknowledged_at IS NULL AND acknowledge_due_at<=clock_timestamp()) AS acknowledgement_overdue,
  (resolution_due_at<=clock_timestamp()) AS resolution_overdue
FROM delivery.workflow_operations_incidents WHERE status_code NOT IN('RESOLVED','CLOSED')
ORDER BY CASE severity_code WHEN 'SEV1' THEN 1 WHEN 'SEV2' THEN 2 WHEN 'SEV3' THEN 3 ELSE 4 END,detected_at;

COMMIT;
