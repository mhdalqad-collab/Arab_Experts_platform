BEGIN;

CREATE TABLE delivery.platform_continuity_plans (
  platform_continuity_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code varchar(50) NOT NULL UNIQUE,
  service_scope varchar(100) NOT NULL,
  criticality_code varchar(12) NOT NULL CHECK(criticality_code IN('CRITICAL','HIGH','MEDIUM','LOW')),
  rpo_minutes integer NOT NULL CHECK(rpo_minutes BETWEEN 0 AND 10080),
  rto_minutes integer NOT NULL CHECK(rto_minutes BETWEEN 1 AND 43200),
  backup_strategy text NOT NULL,
  failover_strategy text NOT NULL,
  failback_strategy text NOT NULL,
  communication_plan text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status_code IN('DRAFT','ACTIVE','UNDER_REVIEW','RETIRED')),
  review_due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE delivery.platform_backup_runs (
  platform_backup_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_continuity_plan_id uuid NOT NULL REFERENCES delivery.platform_continuity_plans(platform_continuity_plan_id) ON DELETE RESTRICT,
  backup_type_code varchar(16) NOT NULL CHECK(backup_type_code IN('FULL','INCREMENTAL','PITR','CONFIG','OBJECTS')),
  status_code varchar(16) NOT NULL CHECK(status_code IN('RUNNING','SUCCEEDED','FAILED','EXPIRED')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  recovery_point_at timestamptz,
  artifact_digest varchar(128),
  encrypted boolean NOT NULL DEFAULT true,
  immutable_until timestamptz,
  size_bytes bigint CHECK(size_bytes IS NULL OR size_bytes>=0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
  CHECK(completed_at IS NULL OR completed_at>=started_at)
);

CREATE TABLE delivery.platform_recovery_exercises (
  platform_recovery_exercise_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_continuity_plan_id uuid NOT NULL REFERENCES delivery.platform_continuity_plans(platform_continuity_plan_id) ON DELETE RESTRICT,
  platform_backup_run_id uuid REFERENCES delivery.platform_backup_runs(platform_backup_run_id) ON DELETE RESTRICT,
  exercise_type_code varchar(20) NOT NULL CHECK(exercise_type_code IN('RESTORE_TEST','TABLETOP','FAILOVER','FULL_DR')),
  status_code varchar(16) NOT NULL DEFAULT 'PLANNED' CHECK(status_code IN('PLANNED','RUNNING','PASSED','FAILED','CANCELLED')),
  planned_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  achieved_rpo_minutes integer CHECK(achieved_rpo_minutes IS NULL OR achieved_rpo_minutes>=0),
  achieved_rto_minutes integer CHECK(achieved_rto_minutes IS NULL OR achieved_rto_minutes>=0),
  data_integrity_verified boolean NOT NULL DEFAULT false,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidence_refs)='array'),
  findings text,
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE VIEW delivery.v_platform_continuity_readiness AS
SELECT p.platform_continuity_plan_id,p.plan_code,p.service_scope,p.rpo_minutes,p.rto_minutes,p.review_due_at,
  x.completed_at AS latest_test_at,x.status_code AS latest_test_status,x.achieved_rpo_minutes,x.achieved_rto_minutes,x.data_integrity_verified,
  CASE WHEN p.status_code<>'ACTIVE' THEN 'NOT_ACTIVE'
       WHEN p.review_due_at<=clock_timestamp() THEN 'REVIEW_OVERDUE'
       WHEN x.platform_recovery_exercise_id IS NULL THEN 'UNTESTED'
       WHEN x.status_code='PASSED' AND x.data_integrity_verified
         AND x.achieved_rpo_minutes<=p.rpo_minutes AND x.achieved_rto_minutes<=p.rto_minutes THEN 'READY'
       ELSE 'NOT_READY' END AS readiness_code
FROM delivery.platform_continuity_plans p
LEFT JOIN LATERAL(
  SELECT e.* FROM delivery.platform_recovery_exercises e
  WHERE e.platform_continuity_plan_id=p.platform_continuity_plan_id
  ORDER BY e.completed_at DESC NULLS LAST LIMIT 1
)x ON true;

CREATE OR REPLACE FUNCTION delivery.evaluate_platform_failover_gate(p_plan_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,delivery AS $$
 SELECT jsonb_build_object(
   'decision',CASE WHEN readiness_code='READY' THEN 'ALLOW' ELSE 'BLOCK' END,
   'readiness',readiness_code,'evaluatedAt',clock_timestamp()
 ) FROM delivery.v_platform_continuity_readiness
 WHERE platform_continuity_plan_id=p_plan_id
$$;

COMMIT;
