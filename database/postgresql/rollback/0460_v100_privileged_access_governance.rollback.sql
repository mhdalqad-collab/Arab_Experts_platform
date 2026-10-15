BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM governance.privileged_access_session_events)
     OR EXISTS (SELECT 1 FROM governance.privileged_access_attestations) THEN
    RAISE EXCEPTION 'Package AC rollback refused: privileged access evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS governance.v_privileged_access_posture;
DROP TABLE governance.privileged_access_attestations;
DROP TABLE governance.privileged_access_session_events;
DROP TABLE governance.privileged_access_sessions;
DROP TABLE governance.privileged_access_grants;
DROP TABLE governance.privileged_access_requests;

COMMIT;
