BEGIN;

CREATE TABLE delivery.platform_capacity_plans (
  platform_capacity_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code varchar(50) NOT NULL UNIQUE,
  service_scope varchar(100) NOT NULL,
  planning_horizon_days integer NOT NULL CHECK(planning_horizon_days BETWEEN 7 AND 1095),
  expected_growth_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK(expected_growth_rate>=0),
  peak_multiplier numeric(8,3) NOT NULL DEFAULT 1 CHECK(peak_multiplier>=1),
  minimum_headroom_percent numeric(6,3) NOT NULL DEFAULT 25 CHECK(minimum_headroom_percent BETWEEN 0 AND 100),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status_code IN('DRAFT','ACTIVE','UNDER_REVIEW','RETIRED')),
  review_due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE delivery.platform_capacity_metrics (
  platform_capacity_metric_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_capacity_plan_id uuid NOT NULL REFERENCES delivery.platform_capacity_plans(platform_capacity_plan_id) ON DELETE RESTRICT,
  metric_code varchar(30) NOT NULL CHECK(metric_code IN('REQUEST_RATE','CONCURRENT_USERS','CPU','MEMORY','DB_CONNECTIONS','STORAGE','QUEUE_DEPTH','THROUGHPUT')),
  unit_code varchar(20) NOT NULL,
  soft_limit numeric(16,4) NOT NULL CHECK(soft_limit>=0),
  hard_limit numeric(16,4) NOT NULL CHECK(hard_limit>soft_limit),
  observed_value numeric(16,4) NOT NULL CHECK(observed_value>=0),
  observed_at timestamptz NOT NULL,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_snapshot)='object'),
  UNIQUE(platform_capacity_plan_id,metric_code,observed_at)
);

CREATE TABLE delivery.platform_load_tests (
  platform_load_test_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_capacity_plan_id uuid NOT NULL REFERENCES delivery.platform_capacity_plans(platform_capacity_plan_id) ON DELETE RESTRICT,
  test_code varchar(50) NOT NULL UNIQUE,
  test_type_code varchar(20) NOT NULL CHECK(test_type_code IN('BASELINE','LOAD','STRESS','SPIKE','SOAK','FAILOVER')),
  environment_code varchar(16) NOT NULL CHECK(environment_code IN('TEST','STAGING','PRODUCTION_LIKE')),
  scenario_version varchar(40) NOT NULL,
  target_users integer CHECK(target_users IS NULL OR target_users>0),
  target_request_rate numeric(16,4) CHECK(target_request_rate IS NULL OR target_request_rate>0),
  achieved_request_rate numeric(16,4),
  p95_latency_ms integer CHECK(p95_latency_ms IS NULL OR p95_latency_ms>=0),
  error_rate numeric(8,5) CHECK(error_rate IS NULL OR error_rate BETWEEN 0 AND 1),
  status_code varchar(16) NOT NULL CHECK(status_code IN('PLANNED','RUNNING','PASSED','FAILED','ABORTED')),
  bottleneck_summary text,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidence_refs)='array'),
  started_at timestamptz,
  completed_at timestamptz,
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE delivery.platform_scaling_policies (
  platform_scaling_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_capacity_plan_id uuid NOT NULL REFERENCES delivery.platform_capacity_plans(platform_capacity_plan_id) ON DELETE RESTRICT,
  policy_code varchar(50) NOT NULL UNIQUE,
  resource_code varchar(40) NOT NULL,
  scaling_mode_code varchar(16) NOT NULL CHECK(scaling_mode_code IN('MANUAL','SCHEDULED','AUTOMATIC')),
  scale_out_threshold numeric(16,4) NOT NULL,
  scale_in_threshold numeric(16,4) NOT NULL,
  minimum_units integer NOT NULL CHECK(minimum_units>0),
  maximum_units integer NOT NULL CHECK(maximum_units>=minimum_units),
  cooldown_seconds integer NOT NULL DEFAULT 300 CHECK(cooldown_seconds BETWEEN 30 AND 86400),
  requires_approval boolean NOT NULL DEFAULT true,
  status_code varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(status_code IN('DRAFT','ACTIVE','PAUSED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(scale_in_threshold<scale_out_threshold)
);

CREATE VIEW delivery.v_platform_capacity_readiness AS
SELECT p.platform_capacity_plan_id,p.plan_code,p.service_scope,p.minimum_headroom_percent,
  max(m.observed_value/m.hard_limit*100) AS maximum_utilization_percent,
  100-max(m.observed_value/m.hard_limit*100) AS available_headroom_percent,
  t.status_code AS latest_load_test_status,t.completed_at AS latest_load_test_at,
  CASE WHEN p.status_code<>'ACTIVE' THEN 'NOT_ACTIVE'
       WHEN p.review_due_at<=clock_timestamp() THEN 'REVIEW_OVERDUE'
       WHEN t.platform_load_test_id IS NULL OR t.status_code<>'PASSED' THEN 'LOAD_TEST_REQUIRED'
       WHEN max(m.observed_value/m.hard_limit*100) >= 100-p.minimum_headroom_percent THEN 'INSUFFICIENT_HEADROOM'
       ELSE 'READY' END AS readiness_code
FROM delivery.platform_capacity_plans p
LEFT JOIN delivery.platform_capacity_metrics m ON m.platform_capacity_plan_id=p.platform_capacity_plan_id
LEFT JOIN LATERAL(
  SELECT x.* FROM delivery.platform_load_tests x WHERE x.platform_capacity_plan_id=p.platform_capacity_plan_id
  ORDER BY x.completed_at DESC NULLS LAST LIMIT 1
)t ON true
GROUP BY p.platform_capacity_plan_id,p.plan_code,p.service_scope,p.minimum_headroom_percent,p.status_code,p.review_due_at,t.platform_load_test_id,t.status_code,t.completed_at;

CREATE OR REPLACE FUNCTION delivery.evaluate_platform_capacity_gate(p_plan_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,delivery AS $$
 SELECT jsonb_build_object(
  'decision',CASE WHEN readiness_code='READY' THEN 'ALLOW' ELSE 'BLOCK' END,
  'readiness',readiness_code,'headroomPercent',available_headroom_percent,
  'evaluatedAt',clock_timestamp()
 ) FROM delivery.v_platform_capacity_readiness WHERE platform_capacity_plan_id=p_plan_id
$$;

COMMIT;
