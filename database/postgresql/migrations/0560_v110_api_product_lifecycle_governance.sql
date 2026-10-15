BEGIN;

CREATE TABLE integration.api_products (
  api_product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(220) NOT NULL,
  description_text text NOT NULL,
  audience_code varchar(20) NOT NULL CHECK (audience_code IN ('INTERNAL','PARTNER','CUSTOMER','PUBLIC')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  support_owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  data_classification_code varchar(24) NOT NULL CHECK (data_classification_code IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  terms_reference text NOT NULL,
  status_code varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status_code IN ('DRAFT','REVIEW','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (owner_party_id <> support_owner_party_id),
  CHECK (audience_code <> 'PUBLIC' OR data_classification_code = 'PUBLIC')
);

CREATE TABLE integration.api_product_versions (
  api_product_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_product_id uuid NOT NULL REFERENCES integration.api_products(api_product_id) ON DELETE RESTRICT,
  version_label varchar(30) NOT NULL,
  lifecycle_code varchar(20) NOT NULL DEFAULT 'DESIGN' CHECK (lifecycle_code IN ('DESIGN','BETA','CURRENT','DEPRECATED','SUNSET','RETIRED')),
  openapi_document_reference text NOT NULL,
  openapi_document_hash char(64) NOT NULL,
  data_contract_version_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(data_contract_version_ids) = 'array'),
  compatibility_code varchar(20) NOT NULL CHECK (compatibility_code IN ('BACKWARD','FORWARD','FULL','BREAKING')),
  released_at timestamptz,
  deprecated_at timestamptz,
  sunset_at timestamptz,
  migration_guide_reference text,
  approval_request_id uuid REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (api_product_id, version_label),
  CHECK (released_at IS NULL OR approval_request_id IS NOT NULL),
  CHECK (deprecated_at IS NULL OR released_at IS NOT NULL),
  CHECK (sunset_at IS NULL OR (deprecated_at IS NOT NULL AND sunset_at > deprecated_at)),
  CHECK (compatibility_code <> 'BREAKING' OR migration_guide_reference IS NOT NULL)
);

CREATE TABLE integration.api_subscriptions (
  api_subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id uuid NOT NULL REFERENCES integration.api_clients(api_client_id) ON DELETE RESTRICT,
  api_product_version_id uuid NOT NULL REFERENCES integration.api_product_versions(api_product_version_id) ON DELETE RESTRICT,
  requested_scopes jsonb NOT NULL CHECK (jsonb_typeof(requested_scopes) = 'array'),
  approved_scopes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(approved_scopes) = 'array'),
  purpose_text text NOT NULL,
  environment_code varchar(16) NOT NULL CHECK (environment_code IN ('DEVELOPMENT','TEST','STAGING','PRODUCTION')),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  approval_request_id uuid REFERENCES governance.approval_requests(approval_request_id) ON DELETE RESTRICT,
  status_code varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status_code IN ('REQUESTED','APPROVED','ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (api_client_id, api_product_version_id, environment_code, valid_from),
  CHECK (valid_to > valid_from),
  CHECK (requested_scopes <> '[]'::jsonb),
  CHECK (status_code NOT IN ('APPROVED','ACTIVE') OR (approval_request_id IS NOT NULL AND approved_scopes <> '[]'::jsonb))
);

CREATE TABLE integration.api_quota_policies (
  api_quota_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_subscription_id uuid NOT NULL REFERENCES integration.api_subscriptions(api_subscription_id) ON DELETE RESTRICT,
  quota_scope_code varchar(20) NOT NULL CHECK (quota_scope_code IN ('PRODUCT','ENDPOINT','SCOPE')),
  scope_reference varchar(180),
  requests_per_minute integer NOT NULL CHECK (requests_per_minute > 0),
  requests_per_day bigint NOT NULL CHECK (requests_per_day > 0),
  burst_limit integer NOT NULL CHECK (burst_limit > 0),
  concurrent_request_limit integer NOT NULL CHECK (concurrent_request_limit > 0),
  payload_size_limit_bytes bigint NOT NULL CHECK (payload_size_limit_bytes > 0),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (quota_scope_code = 'PRODUCT' OR scope_reference IS NOT NULL),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (burst_limit >= requests_per_minute)
);

CREATE TABLE integration.api_usage_windows (
  api_usage_window_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_subscription_id uuid NOT NULL REFERENCES integration.api_subscriptions(api_subscription_id) ON DELETE RESTRICT,
  api_endpoint_id uuid REFERENCES integration.api_endpoints(api_endpoint_id) ON DELETE RESTRICT,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  request_count bigint NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  success_count bigint NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  client_error_count bigint NOT NULL DEFAULT 0 CHECK (client_error_count >= 0),
  server_error_count bigint NOT NULL DEFAULT 0 CHECK (server_error_count >= 0),
  throttled_count bigint NOT NULL DEFAULT 0 CHECK (throttled_count >= 0),
  transferred_bytes bigint NOT NULL DEFAULT 0 CHECK (transferred_bytes >= 0),
  p95_latency_ms numeric(12,3) CHECK (p95_latency_ms IS NULL OR p95_latency_ms >= 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (api_subscription_id, api_endpoint_id, window_start, window_end),
  CHECK (window_end > window_start),
  CHECK (success_count + client_error_count + server_error_count <= request_count)
);

CREATE TABLE integration.api_deprecation_notices (
  api_deprecation_notice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_product_version_id uuid NOT NULL REFERENCES integration.api_product_versions(api_product_version_id) ON DELETE RESTRICT,
  replacement_version_id uuid REFERENCES integration.api_product_versions(api_product_version_id) ON DELETE RESTRICT,
  notice_text text NOT NULL,
  breaking_changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(breaking_changes) = 'array'),
  migration_guide_reference text NOT NULL,
  announced_at timestamptz NOT NULL,
  minimum_notice_days integer NOT NULL CHECK (minimum_notice_days > 0),
  sunset_at timestamptz NOT NULL,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (replacement_version_id IS NULL OR replacement_version_id <> api_product_version_id),
  CHECK (sunset_at >= announced_at + make_interval(days => minimum_notice_days))
);

CREATE VIEW integration.v_api_subscription_readiness AS
SELECT s.api_subscription_id,p.product_code,v.version_label,
       CASE
         WHEN p.status_code <> 'ACTIVE' THEN 'API_PRODUCT_NOT_ACTIVE'
         WHEN v.lifecycle_code NOT IN ('BETA','CURRENT','DEPRECATED') THEN 'API_VERSION_NOT_CONSUMABLE'
         WHEN s.status_code <> 'ACTIVE' THEN 'SUBSCRIPTION_NOT_ACTIVE'
         WHEN s.valid_to <= clock_timestamp() THEN 'SUBSCRIPTION_EXPIRED'
         WHEN NOT EXISTS(SELECT 1 FROM integration.api_quota_policies q WHERE q.api_subscription_id=s.api_subscription_id AND q.effective_from<=clock_timestamp() AND (q.effective_to IS NULL OR q.effective_to>clock_timestamp())) THEN 'QUOTA_POLICY_REQUIRED'
         WHEN v.lifecycle_code='DEPRECATED' AND NOT EXISTS(SELECT 1 FROM integration.api_deprecation_notices n WHERE n.api_product_version_id=v.api_product_version_id) THEN 'DEPRECATION_NOTICE_REQUIRED'
         ELSE 'READY_FOR_API_ACCESS'
       END AS readiness_code
FROM integration.api_subscriptions s
JOIN integration.api_product_versions v ON v.api_product_version_id=s.api_product_version_id
JOIN integration.api_products p ON p.api_product_id=v.api_product_id;

COMMIT;
