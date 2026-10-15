BEGIN;

CREATE TABLE finance.platform_cost_centers (
  platform_cost_center_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_center_code varchar(40) NOT NULL UNIQUE,
  name_ar varchar(160) NOT NULL,
  service_scope varchar(100) NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK(status_code IN('ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE finance.platform_cost_budgets (
  platform_cost_budget_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_cost_center_id uuid NOT NULL REFERENCES finance.platform_cost_centers(platform_cost_center_id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency_code char(3) NOT NULL,
  approved_amount numeric(18,4) NOT NULL CHECK(approved_amount>=0),
  warning_percent numeric(6,3) NOT NULL DEFAULT 80 CHECK(warning_percent BETWEEN 0 AND 100),
  critical_percent numeric(6,3) NOT NULL DEFAULT 100 CHECK(critical_percent>=warning_percent),
  approved_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(period_end>=period_start),
  UNIQUE(platform_cost_center_id,period_start,period_end,currency_code)
);

CREATE TABLE finance.platform_cost_observations (
  platform_cost_observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_cost_center_id uuid NOT NULL REFERENCES finance.platform_cost_centers(platform_cost_center_id) ON DELETE RESTRICT,
  cost_category_code varchar(24) NOT NULL CHECK(cost_category_code IN('COMPUTE','DATABASE','STORAGE','NETWORK','OBSERVABILITY','SECURITY','LICENSE','SUPPORT','OTHER')),
  provider_code varchar(40),
  usage_date date NOT NULL,
  currency_code char(3) NOT NULL,
  actual_amount numeric(18,4) NOT NULL CHECK(actual_amount>=0),
  quantity numeric(18,6),
  unit_code varchar(30),
  allocation_tags jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(allocation_tags)='object'),
  source_reference varchar(160) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(platform_cost_center_id,cost_category_code,usage_date,source_reference)
);

CREATE TABLE finance.platform_unit_economics (
  platform_unit_economics_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_cost_center_id uuid NOT NULL REFERENCES finance.platform_cost_centers(platform_cost_center_id) ON DELETE RESTRICT,
  unit_code varchar(30) NOT NULL CHECK(unit_code IN('ACTIVE_MEMBER','SEARCH','MATCHING_RUN','SERVICE_REQUEST','CONTRACT','COURSE_ENROLLMENT')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_cost numeric(18,4) NOT NULL CHECK(total_cost>=0),
  unit_count bigint NOT NULL CHECK(unit_count>0),
  cost_per_unit numeric(18,6) GENERATED ALWAYS AS (total_cost/unit_count) STORED,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_snapshot)='object'),
  measured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(platform_cost_center_id,unit_code,period_start,period_end)
);

CREATE VIEW finance.v_platform_finops_budget_status AS
SELECT b.platform_cost_budget_id,c.cost_center_code,c.service_scope,b.period_start,b.period_end,b.currency_code,b.approved_amount,
 coalesce(sum(o.actual_amount),0) AS actual_amount,
 round(coalesce(sum(o.actual_amount),0)/nullif(b.approved_amount,0)*100,3) AS consumed_percent,
 CASE WHEN coalesce(sum(o.actual_amount),0)>b.approved_amount*b.critical_percent/100 THEN 'BREACHED'
      WHEN coalesce(sum(o.actual_amount),0)>b.approved_amount*b.warning_percent/100 THEN 'AT_RISK'
      ELSE 'WITHIN_BUDGET' END AS budget_status
FROM finance.platform_cost_budgets b JOIN finance.platform_cost_centers c ON c.platform_cost_center_id=b.platform_cost_center_id
LEFT JOIN finance.platform_cost_observations o ON o.platform_cost_center_id=b.platform_cost_center_id AND o.usage_date BETWEEN b.period_start AND b.period_end AND o.currency_code=b.currency_code
GROUP BY b.platform_cost_budget_id,c.cost_center_code,c.service_scope,b.period_start,b.period_end,b.currency_code,b.approved_amount,b.warning_percent,b.critical_percent;

CREATE OR REPLACE FUNCTION finance.evaluate_platform_cost_optimization_gate(p_cost_center_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,finance,delivery AS $$
DECLARE v_reasons jsonb:='[]'::jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM delivery.v_workflow_reliability_dashboard WHERE compliance_code IN('AT_RISK','BREACHED')) THEN v_reasons:=v_reasons||jsonb_build_array('SLO_PROTECTION_REQUIRED'); END IF;
 IF EXISTS(SELECT 1 FROM delivery.v_platform_capacity_readiness WHERE readiness_code<>'READY') THEN v_reasons:=v_reasons||jsonb_build_array('CAPACITY_PROTECTION_REQUIRED'); END IF;
 RETURN jsonb_build_object('decision',CASE WHEN jsonb_array_length(v_reasons)=0 THEN 'REVIEW_ALLOWED' ELSE 'BLOCK' END,'reasons',v_reasons,'evaluatedAt',clock_timestamp());
END $$;

COMMIT;
