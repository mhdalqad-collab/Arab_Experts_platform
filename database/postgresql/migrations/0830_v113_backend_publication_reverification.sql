BEGIN;

CREATE TABLE professional.publication_reverification_policies(
 policy_code varchar(50) PRIMARY KEY,
 warning_days integer NOT NULL CHECK(warning_days BETWEEN 1 AND 180),
 grace_days integer NOT NULL CHECK(grace_days BETWEEN 0 AND 90),
 is_active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO professional.publication_reverification_policies(policy_code,warning_days,grace_days)
VALUES('DEFAULT',30,14) ON CONFLICT(policy_code) DO NOTHING;

CREATE TABLE professional.publication_reverification_assessments(
 publication_reverification_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 published_profile_materialization_id uuid NOT NULL REFERENCES professional.published_profile_materializations(published_profile_materialization_id) ON DELETE RESTRICT,
 assessed_as_of date NOT NULL,
 earliest_expiry_date date,
 evidence_count integer NOT NULL CHECK(evidence_count>=0),
 expiring_evidence_count integer NOT NULL CHECK(expiring_evidence_count>=0),
 expired_evidence_count integer NOT NULL CHECK(expired_evidence_count>=0),
 status_code varchar(20) NOT NULL CHECK(status_code IN('NO_EXPIRY','VALID','EXPIRING','GRACE','OVERDUE')),
 action_code varchar(30) NOT NULL CHECK(action_code IN('NONE','WARNING','GRACE_WARNING','AUTO_SUSPENDED','ALREADY_INACTIVE')),
 policy_snapshot jsonb NOT NULL,
 assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 correlation_id varchar(120),
 UNIQUE(published_profile_materialization_id,assessed_as_of)
);
CREATE INDEX idx_publication_reverification_assessments_status ON professional.publication_reverification_assessments(status_code,assessed_as_of DESC);

CREATE TABLE professional.publication_reverification_alerts(
 publication_reverification_alert_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 published_profile_materialization_id uuid NOT NULL REFERENCES professional.published_profile_materializations(published_profile_materialization_id) ON DELETE RESTRICT,
 recipient_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
 alert_type_code varchar(40) NOT NULL CHECK(alert_type_code IN('EXPIRY_WARNING','REVERIFICATION_REQUIRED','PUBLICATION_AUTO_SUSPENDED')),
 due_date date NOT NULL,
 status_code varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(status_code IN('OPEN','RESOLVED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_at timestamptz,
 correlation_id varchar(120)
);
CREATE UNIQUE INDEX uq_publication_reverification_open_alert ON professional.publication_reverification_alerts(published_profile_materialization_id,alert_type_code) WHERE status_code='OPEN';
CREATE INDEX idx_publication_reverification_alert_recipient ON professional.publication_reverification_alerts(recipient_party_id,status_code,due_date);

CREATE OR REPLACE FUNCTION professional.evaluate_publication_reverification(p_actor_party_id uuid,p_user_account_id uuid,p_as_of_date date DEFAULT CURRENT_DATE,p_correlation_id varchar DEFAULT NULL)
RETURNS TABLE(assessed_count integer,alerts_created integer,suspended_count integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,professional,governance AS $$
DECLARE
 v_policy professional.publication_reverification_policies%ROWTYPE;
 v record;v_status varchar(20);v_action varchar(30);v_alert_type varchar(40);v_due date;
 v_assessed integer:=0;v_alerts integer:=0;v_suspended integer:=0;v_inserted integer;
BEGIN
 IF p_as_of_date IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Assessment date is required';END IF;
 SELECT * INTO v_policy FROM professional.publication_reverification_policies WHERE is_active ORDER BY policy_code LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='No active publication reverification policy';END IF;
 FOR v IN
  SELECT m.published_profile_materialization_id,m.lifecycle_status_code,r.requested_by_party_id,
   count(e.item)::integer AS evidence_count,
   min(CASE WHEN nullif(e.item->>'expiresAt','') IS NOT NULL THEN (e.item->>'expiresAt')::timestamptz::date END) AS earliest_expiry_date,
   count(*) FILTER(WHERE nullif(e.item->>'expiresAt','') IS NOT NULL AND (e.item->>'expiresAt')::timestamptz::date BETWEEN p_as_of_date AND p_as_of_date+v_policy.warning_days)::integer AS expiring_count,
   count(*) FILTER(WHERE nullif(e.item->>'expiresAt','') IS NOT NULL AND (e.item->>'expiresAt')::timestamptz::date<p_as_of_date)::integer AS expired_count
  FROM professional.published_profile_materializations m
  JOIN professional.profile_publication_requests r USING(profile_publication_request_id)
  LEFT JOIN LATERAL jsonb_array_elements(coalesce(m.sealed_snapshot->'consolidatedSnapshot'->'originalReviewContext'->'verifiedEvidenceSummaries','[]'::jsonb)) e(item) ON true
  WHERE m.lifecycle_status_code IN('ACTIVE','SUSPENDED')
  GROUP BY m.published_profile_materialization_id,m.lifecycle_status_code,r.requested_by_party_id
 LOOP
  PERFORM 1 FROM professional.published_profile_materializations WHERE published_profile_materialization_id=v.published_profile_materialization_id FOR UPDATE;
  v_alert_type:=NULL;v_due:=coalesce(v.earliest_expiry_date,p_as_of_date);v_action:='NONE';
  IF v.earliest_expiry_date IS NULL THEN v_status:='NO_EXPIRY';
  ELSIF v.earliest_expiry_date>p_as_of_date+v_policy.warning_days THEN v_status:='VALID';
  ELSIF v.earliest_expiry_date>=p_as_of_date THEN v_status:='EXPIRING';v_action:='WARNING';v_alert_type:='EXPIRY_WARNING';
  ELSIF p_as_of_date<=v.earliest_expiry_date+v_policy.grace_days THEN v_status:='GRACE';v_action:='GRACE_WARNING';v_alert_type:='REVERIFICATION_REQUIRED';v_due:=v.earliest_expiry_date+v_policy.grace_days;
  ELSE
   v_status:='OVERDUE';v_alert_type:='PUBLICATION_AUTO_SUSPENDED';v_due:=p_as_of_date;
   IF v.lifecycle_status_code='ACTIVE' THEN
    PERFORM professional.transition_published_profile_lifecycle(v.published_profile_materialization_id,p_actor_party_id,p_user_account_id,'SUSPEND','Automatic suspension because sealed evidence exceeded the reverification grace period',p_correlation_id);
    v_action:='AUTO_SUSPENDED';v_suspended:=v_suspended+1;
   ELSE v_action:='ALREADY_INACTIVE';END IF;
  END IF;
  IF v_status IN('NO_EXPIRY','VALID') THEN
   UPDATE professional.publication_reverification_alerts SET status_code='RESOLVED',resolved_at=clock_timestamp() WHERE published_profile_materialization_id=v.published_profile_materialization_id AND status_code='OPEN';
  ELSIF v_alert_type IS NOT NULL THEN
   INSERT INTO professional.publication_reverification_alerts(published_profile_materialization_id,recipient_party_id,alert_type_code,due_date,correlation_id)
   VALUES(v.published_profile_materialization_id,v.requested_by_party_id,v_alert_type,v_due,p_correlation_id) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS v_inserted=ROW_COUNT;v_alerts:=v_alerts+v_inserted;
  END IF;
  INSERT INTO professional.publication_reverification_assessments(published_profile_materialization_id,assessed_as_of,earliest_expiry_date,evidence_count,expiring_evidence_count,expired_evidence_count,status_code,action_code,policy_snapshot,correlation_id)
  VALUES(v.published_profile_materialization_id,p_as_of_date,v.earliest_expiry_date,v.evidence_count,v.expiring_count,v.expired_count,v_status,v_action,jsonb_build_object('policyCode',v_policy.policy_code,'warningDays',v_policy.warning_days,'graceDays',v_policy.grace_days),p_correlation_id)
  ON CONFLICT(published_profile_materialization_id,assessed_as_of) DO UPDATE SET earliest_expiry_date=excluded.earliest_expiry_date,evidence_count=excluded.evidence_count,expiring_evidence_count=excluded.expiring_evidence_count,expired_evidence_count=excluded.expired_evidence_count,status_code=excluded.status_code,action_code=excluded.action_code,policy_snapshot=excluded.policy_snapshot,assessed_at=clock_timestamp(),correlation_id=excluded.correlation_id;
  v_assessed:=v_assessed+1;
 END LOOP;
 PERFORM governance.append_audit_event('PROFESSIONAL','PUBLICATION_REVERIFICATION_MONITORED',p_actor_party_id,p_user_account_id,'PLATFORM_ADMIN','publication_reverification_run',NULL,p_correlation_id,'SUCCESS','HIGH','MONITORED',jsonb_build_object('as_of_date',p_as_of_date,'assessed_count',v_assessed,'alerts_created',v_alerts,'suspended_count',v_suspended));
 RETURN QUERY SELECT v_assessed,v_alerts,v_suspended;
END;$$;

INSERT INTO integration.schema_migrations(migration_name) VALUES('0830_v113_backend_publication_reverification') ON CONFLICT DO NOTHING;
COMMIT;
