BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM integration.api_usage_windows)
    OR EXISTS(SELECT 1 FROM integration.api_subscriptions WHERE status_code IN('ACTIVE','SUSPENDED','REVOKED','EXPIRED'))
    OR EXISTS(SELECT 1 FROM integration.api_deprecation_notices)
 THEN RAISE EXCEPTION 'rollback refused: API usage, subscriptions, or deprecation evidence exists'; END IF;
END $$;
DROP VIEW IF EXISTS integration.v_api_subscription_readiness;
DROP TABLE IF EXISTS integration.api_deprecation_notices;
DROP TABLE IF EXISTS integration.api_usage_windows;
DROP TABLE IF EXISTS integration.api_quota_policies;
DROP TABLE IF EXISTS integration.api_subscriptions;
DROP TABLE IF EXISTS integration.api_product_versions;
DROP TABLE IF EXISTS integration.api_products;
COMMIT;
