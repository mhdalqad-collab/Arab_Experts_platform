BEGIN;
DROP FUNCTION IF EXISTS professional.issue_review_document_download_session(uuid,uuid,uuid,uuid,uuid,uuid,char,text,timestamptz,varchar);
DROP INDEX IF EXISTS core.idx_review_download_sessions;
ALTER TABLE core.file_download_sessions DROP CONSTRAINT IF EXISTS ck_review_download_context;
ALTER TABLE core.file_download_sessions DROP COLUMN IF EXISTS access_reason,DROP COLUMN IF EXISTS purpose_code,DROP COLUMN IF EXISTS publication_request_id;
DELETE FROM governance.role_permissions WHERE permission_id=(SELECT permission_id FROM governance.permissions WHERE permission_code='professional.review.document');
DELETE FROM governance.permissions WHERE permission_code='professional.review.document';
DELETE FROM integration.schema_migrations WHERE migration_name='0770_v113_backend_controlled_review_documents';
COMMIT;
