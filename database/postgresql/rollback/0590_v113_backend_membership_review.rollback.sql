BEGIN;
DROP FUNCTION IF EXISTS membership.decide_application(uuid,uuid,uuid,varchar,varchar,text,varchar);
DROP FUNCTION IF EXISTS membership.complete_application_review(uuid,uuid,uuid,varchar,text,varchar);
DROP FUNCTION IF EXISTS membership.claim_application_review(uuid,uuid,uuid,varchar);
DELETE FROM governance.role_permissions WHERE permission_id IN (SELECT permission_id FROM governance.permissions WHERE permission_code IN ('membership.review','membership.approve'));
DELETE FROM governance.segregation_of_duties_rules WHERE rule_code='SOD_MEMBERSHIP_REVIEW_APPROVE';
DELETE FROM governance.permissions WHERE permission_code IN ('membership.review','membership.approve');
DELETE FROM integration.schema_migrations WHERE migration_name='0590_v113_backend_membership_review';
COMMIT;
