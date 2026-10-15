BEGIN;

CREATE TABLE integration.scheduled_job_definitions(
 job_code varchar(100) PRIMARY KEY,
 description text NOT NULL,
 schedule_expression varchar(100) NOT NULL,
 timezone_name varchar(80) NOT NULL DEFAULT 'UTC',
 maximum_attempts integer NOT NULL DEFAULT 3 CHECK(maximum_attempts BETWEEN 1 AND 10),
 stale_after_minutes integer NOT NULL DEFAULT 30 CHECK(stale_after_minutes BETWEEN 5 AND 1440),
 is_enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO integration.scheduled_job_definitions(job_code,description,schedule_expression,timezone_name,maximum_attempts,stale_after_minutes)
VALUES('PROFESSIONAL_PUBLICATION_REVERIFICATION','Daily monitoring of sealed professional evidence expiry and controlled publication suspension','0 2 * * *','Asia/Muscat',3,30)
ON CONFLICT(job_code) DO NOTHING;

CREATE TABLE integration.scheduled_job_runs(
 scheduled_job_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_code varchar(100) NOT NULL REFERENCES integration.scheduled_job_definitions(job_code) ON DELETE RESTRICT,
 scheduled_for_date date NOT NULL,
 attempt_no integer NOT NULL CHECK(attempt_no BETWEEN 1 AND 10),
 status_code varchar(20) NOT NULL CHECK(status_code IN('RUNNING','SUCCEEDED','FAILED','SKIPPED')),
 requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 user_account_id uuid NOT NULL REFERENCES iam.user_accounts(user_account_id) ON DELETE RESTRICT,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 result_summary jsonb,
 error_code varchar(100),
 error_message text,
 correlation_id varchar(120),
 UNIQUE(job_code,scheduled_for_date,attempt_no)
);
CREATE INDEX idx_scheduled_job_runs_status ON integration.scheduled_job_runs(job_code,status_code,scheduled_for_date DESC,attempt_no DESC);

CREATE OR REPLACE FUNCTION integration.run_publication_reverification_job(p_actor_party_id uuid,p_user_account_id uuid,p_scheduled_for_date date DEFAULT CURRENT_DATE,p_correlation_id varchar DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,integration,professional,governance AS $$
DECLARE
 v_definition integration.scheduled_job_definitions%ROWTYPE;v_previous integration.scheduled_job_runs%ROWTYPE;
 v_run_id uuid;v_attempt integer;v_assessed integer;v_alerts integer;v_suspended integer;v_now timestamptz:=clock_timestamp();v_result jsonb;
BEGIN
 IF p_scheduled_for_date IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Scheduled date is required';END IF;
 SELECT * INTO v_definition FROM integration.scheduled_job_definitions WHERE job_code='PROFESSIONAL_PUBLICATION_REVERIFICATION' FOR UPDATE;
 IF NOT FOUND OR NOT v_definition.is_enabled THEN RETURN jsonb_build_object('statusCode','SKIPPED','reason','JOB_DISABLED');END IF;
 IF NOT pg_try_advisory_xact_lock(hashtext('EIM:PROFESSIONAL_PUBLICATION_REVERIFICATION')) THEN RETURN jsonb_build_object('statusCode','SKIPPED','reason','CONCURRENT_RUN');END IF;
 SELECT * INTO v_previous FROM integration.scheduled_job_runs WHERE job_code=v_definition.job_code AND scheduled_for_date=p_scheduled_for_date ORDER BY attempt_no DESC LIMIT 1 FOR UPDATE;
 IF FOUND AND v_previous.status_code='SUCCEEDED' THEN RETURN jsonb_build_object('scheduledJobRunId',v_previous.scheduled_job_run_id,'statusCode','SKIPPED','reason','ALREADY_SUCCEEDED','resultSummary',v_previous.result_summary);END IF;
 IF FOUND AND v_previous.status_code='RUNNING' AND v_previous.heartbeat_at>v_now-make_interval(mins=>v_definition.stale_after_minutes) THEN RETURN jsonb_build_object('scheduledJobRunId',v_previous.scheduled_job_run_id,'statusCode','SKIPPED','reason','RUNNING');END IF;
 v_attempt:=CASE WHEN FOUND THEN v_previous.attempt_no+1 ELSE 1 END;
 IF v_attempt>v_definition.maximum_attempts THEN RETURN jsonb_build_object('scheduledJobRunId',v_previous.scheduled_job_run_id,'statusCode','SKIPPED','reason','MAXIMUM_ATTEMPTS_REACHED');END IF;
 IF FOUND AND v_previous.status_code='RUNNING' THEN UPDATE integration.scheduled_job_runs SET status_code='FAILED',finished_at=v_now,error_code='STALE_RUN',error_message='Run heartbeat exceeded the configured stale threshold' WHERE scheduled_job_run_id=v_previous.scheduled_job_run_id;END IF;
 INSERT INTO integration.scheduled_job_runs(job_code,scheduled_for_date,attempt_no,status_code,requested_by_party_id,user_account_id,correlation_id)
 VALUES(v_definition.job_code,p_scheduled_for_date,v_attempt,'RUNNING',p_actor_party_id,p_user_account_id,p_correlation_id) RETURNING scheduled_job_run_id INTO v_run_id;
 BEGIN
  SELECT assessed_count,alerts_created,suspended_count INTO v_assessed,v_alerts,v_suspended FROM professional.evaluate_publication_reverification(p_actor_party_id,p_user_account_id,p_scheduled_for_date,p_correlation_id);
  v_result:=jsonb_build_object('assessedCount',v_assessed,'alertsCreated',v_alerts,'suspendedCount',v_suspended,'scheduledForDate',p_scheduled_for_date);
  UPDATE integration.scheduled_job_runs SET status_code='SUCCEEDED',heartbeat_at=clock_timestamp(),finished_at=clock_timestamp(),result_summary=v_result WHERE scheduled_job_run_id=v_run_id;
  PERFORM governance.append_audit_event('INTEGRATION','SCHEDULED_JOB_SUCCEEDED',p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','scheduled_job_run',v_run_id,p_correlation_id,'SUCCESS','HIGH','SUCCEEDED',jsonb_build_object('job_code',v_definition.job_code,'attempt_no',v_attempt,'result',v_result));
  RETURN jsonb_build_object('scheduledJobRunId',v_run_id,'statusCode','SUCCEEDED','attemptNo',v_attempt,'resultSummary',v_result);
 EXCEPTION WHEN OTHERS THEN
  UPDATE integration.scheduled_job_runs SET status_code='FAILED',heartbeat_at=clock_timestamp(),finished_at=clock_timestamp(),error_code=SQLSTATE,error_message=left(SQLERRM,2000) WHERE scheduled_job_run_id=v_run_id;
  PERFORM governance.append_audit_event('INTEGRATION','SCHEDULED_JOB_FAILED',p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','scheduled_job_run',v_run_id,p_correlation_id,'FAILURE','HIGH','FAILED',jsonb_build_object('job_code',v_definition.job_code,'attempt_no',v_attempt,'error_code',SQLSTATE));
  RETURN jsonb_build_object('scheduledJobRunId',v_run_id,'statusCode','FAILED','attemptNo',v_attempt,'errorCode',SQLSTATE);
 END;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0840_v113_backend_scheduled_job_control') ON CONFLICT DO NOTHING;
COMMIT;
