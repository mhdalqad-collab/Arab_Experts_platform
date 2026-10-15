BEGIN;

CREATE TABLE delivery.workflow_reliability_objectives (
  workflow_reliability_objective_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_code varchar(50) NOT NULL UNIQUE,
  indicator_code varchar(30) NOT NULL CHECK (indicator_code IN ('AVAILABILITY','SUCCESS_RATE','P95_LATENCY','MTTA','MTTR','OUTBOX_LAG')),
  service_scope varchar(80) NOT NULL,
  target_operator varchar(4) NOT NULL CHECK (target_operator IN ('>=','<=','<','>')),
  target_value numeric(14,5) NOT NULL,
  unit_code varchar(20) NOT NULL CHECK (unit_code IN ('PERCENT','MILLISECONDS','MINUTES','HOURS','COUNT')),
  window_days integer NOT NULL CHECK (window_days BETWEEN 1 AND 365),
  error_budget_value numeric(14,5),
  warning_burn_rate numeric(8,3) NOT NULL DEFAULT 1,
  critical_burn_rate numeric(8,3) NOT NULL DEFAULT 2,
  status_code varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK (status_code IN ('DRAFT','ACTIVE','RETIRED')),
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (effective_to IS NULL OR effective_to>effective_from)
);

CREATE TABLE delivery.workflow_reliability_measurements (
  workflow_reliability_measurement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_reliability_objective_id uuid NOT NULL REFERENCES delivery.workflow_reliability_objectives(workflow_reliability_objective_id) ON DELETE RESTRICT,
  window_started_at timestamptz NOT NULL,
  window_ended_at timestamptz NOT NULL,
  observed_value numeric(14,5) NOT NULL,
  good_events bigint CHECK (good_events IS NULL OR good_events>=0),
  total_events bigint CHECK (total_events IS NULL OR total_events>=0),
  error_budget_consumed numeric(12,5),
  burn_rate numeric(12,5),
  compliance_code varchar(16) NOT NULL CHECK (compliance_code IN ('MET','AT_RISK','BREACHED','NO_DATA')),
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_snapshot)='object'),
  measured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(workflow_reliability_objective_id,window_started_at,window_ended_at),
  CHECK (window_ended_at>window_started_at),
  CHECK (total_events IS NULL OR good_events IS NULL OR good_events<=total_events)
);

CREATE TABLE delivery.workflow_reliability_budget_events (
  workflow_reliability_budget_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_reliability_objective_id uuid NOT NULL REFERENCES delivery.workflow_reliability_objectives(workflow_reliability_objective_id) ON DELETE RESTRICT,
  workflow_reliability_measurement_id uuid REFERENCES delivery.workflow_reliability_measurements(workflow_reliability_measurement_id) ON DELETE RESTRICT,
  event_code varchar(24) NOT NULL CHECK (event_code IN ('WARNING','BREACHED','RECOVERED','CHANGE_FREEZE_PROPOSED','REVIEWED')),
  burn_rate numeric(12,5),
  note text NOT NULL,
  actor_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE VIEW delivery.v_workflow_reliability_incident_metrics AS
SELECT
  count(*) FILTER(WHERE detected_at>=clock_timestamp()-interval '30 days') AS incidents_30d,
  round(avg(extract(epoch FROM (acknowledged_at-detected_at))/60) FILTER(WHERE acknowledged_at IS NOT NULL),2) AS mtta_minutes,
  round(avg(extract(epoch FROM (resolved_at-detected_at))/3600) FILTER(WHERE resolved_at IS NOT NULL),2) AS mttr_hours,
  count(*) FILTER(WHERE status_code NOT IN('RESOLVED','CLOSED')) AS active_incidents,
  count(*) FILTER(WHERE escalated_at IS NOT NULL AND status_code NOT IN('RESOLVED','CLOSED')) AS escalated_incidents
FROM delivery.workflow_operations_incidents;

CREATE VIEW delivery.v_workflow_reliability_dashboard AS
SELECT o.objective_code,o.indicator_code,o.service_scope,o.target_operator,o.target_value,o.unit_code,o.window_days,
  m.observed_value,m.compliance_code,m.error_budget_consumed,m.burn_rate,m.window_ended_at
FROM delivery.workflow_reliability_objectives o
LEFT JOIN LATERAL (
  SELECT x.* FROM delivery.workflow_reliability_measurements x
  WHERE x.workflow_reliability_objective_id=o.workflow_reliability_objective_id
  ORDER BY x.window_ended_at DESC LIMIT 1
) m ON true WHERE o.status_code='ACTIVE';

COMMIT;
