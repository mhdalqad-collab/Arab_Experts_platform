BEGIN;

DROP FUNCTION IF EXISTS iam.register_external_person(
  varchar, text, text, boolean, varchar, varchar, varchar, varchar, varchar
);
DROP FUNCTION IF EXISTS governance.append_audit_event(
  varchar, varchar, uuid, uuid, varchar, varchar, uuid, varchar,
  varchar, varchar, varchar, jsonb
);

DELETE FROM integration.schema_migrations
WHERE migration_name = '0570_v113_backend_identity_onboarding';

COMMIT;
