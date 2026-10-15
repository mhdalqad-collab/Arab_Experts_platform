BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM governance.security_secret_rotation_events)
     OR EXISTS (SELECT 1 FROM governance.security_certificate_inventory) THEN
    RAISE EXCEPTION 'Package AD rollback refused: secret rotation or certificate evidence already exists';
  END IF;
END
$$;

DROP VIEW IF EXISTS governance.v_security_secret_posture;
DROP TABLE governance.security_certificate_inventory;
DROP TABLE governance.security_secret_rotation_events;
DROP TABLE governance.security_secret_bindings;
DROP TABLE governance.security_secret_records;
DROP TABLE governance.security_secret_policies;

COMMIT;
