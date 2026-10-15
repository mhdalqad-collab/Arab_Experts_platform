BEGIN;
DROP FUNCTION IF EXISTS governance.public_party_projection(uuid);
DROP FUNCTION IF EXISTS core.revoke_self_file_access_grant(uuid,uuid,uuid,text,varchar);
DROP FUNCTION IF EXISTS governance.set_self_field_privacy(uuid,uuid,varchar,uuid,varchar,varchar,jsonb,text,varchar);
DELETE FROM integration.schema_migrations WHERE migration_name='0640_v113_backend_privacy_projection';
COMMIT;
