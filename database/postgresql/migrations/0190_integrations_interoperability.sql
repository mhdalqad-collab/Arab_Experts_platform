BEGIN;

-- Integration registry, data contracts, mappings, outbox/inbox and sync observability.

CREATE TABLE integration.external_systems (
  external_system_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  name_en varchar(240),
  category_code varchar(40) NOT NULL
    CHECK (category_code IN (
      'IDENTITY', 'PAYMENT', 'NOTIFICATION', 'SEARCH', 'STORAGE',
      'ANALYTICS', 'LEARNING', 'CRM', 'GOVERNMENT', 'OTHER'
    )),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  vendor_name varchar(200),
  data_residency_country_code char(2)
    REFERENCES reference.countries(country_code),
  criticality_code varchar(20) NOT NULL DEFAULT 'NORMAL'
    CHECK (criticality_code IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status_code IN ('PLANNED', 'ACTIVE', 'SUSPENDED', 'RETIRED')),
  description_ar text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE integration.integration_connections (
  integration_connection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_code varchar(80) NOT NULL UNIQUE,
  external_system_id uuid NOT NULL
    REFERENCES integration.external_systems(external_system_id) ON DELETE RESTRICT,
  environment_code varchar(20) NOT NULL
    CHECK (environment_code IN ('DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION')),
  direction_code varchar(20) NOT NULL
    CHECK (direction_code IN ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL')),
  transport_code varchar(30) NOT NULL
    CHECK (transport_code IN ('REST', 'GRAPHQL', 'WEBHOOK', 'SFTP', 'QUEUE', 'DATABASE', 'FILE')),
  base_endpoint_url text,
  authentication_type_code varchar(30)
    CHECK (authentication_type_code IN ('NONE', 'API_KEY', 'OAUTH2', 'MTLS', 'SIGNED_JWT', 'BASIC')),
  credential_secret_reference text,
  timeout_seconds integer NOT NULL DEFAULT 30 CHECK (timeout_seconds BETWEEN 1 AND 600),
  max_retries smallint NOT NULL DEFAULT 3 CHECK (max_retries BETWEEN 0 AND 20),
  retry_backoff_seconds integer NOT NULL DEFAULT 5 CHECK (retry_backoff_seconds >= 0),
  status_code varchar(20) NOT NULL DEFAULT 'DISCONNECTED'
    CHECK (status_code IN ('DISCONNECTED', 'CONNECTED', 'DEGRADED', 'SUSPENDED', 'RETIRED')),
  activated_at timestamptz,
  last_health_check_at timestamptz,
  last_health_status_code varchar(20),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_integration_secret_reference CHECK (
    authentication_type_code IS NULL
    OR authentication_type_code = 'NONE'
    OR credential_secret_reference IS NOT NULL
  ),
  UNIQUE (external_system_id, environment_code, direction_code)
);

CREATE TABLE integration.api_endpoints (
  api_endpoint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_connection_id uuid NOT NULL
    REFERENCES integration.integration_connections(integration_connection_id) ON DELETE CASCADE,
  endpoint_code varchar(80) NOT NULL,
  operation_name varchar(180) NOT NULL,
  http_method varchar(10)
    CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  relative_path text,
  resource_type varchar(80) NOT NULL,
  purpose_code varchar(60),
  rate_limit_per_minute integer CHECK (rate_limit_per_minute IS NULL OR rate_limit_per_minute > 0),
  is_idempotent boolean NOT NULL DEFAULT false,
  requires_signature boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (integration_connection_id, endpoint_code)
);

CREATE TABLE integration.data_contracts (
  data_contract_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  source_system_id uuid NOT NULL
    REFERENCES integration.external_systems(external_system_id) ON DELETE RESTRICT,
  target_system_id uuid
    REFERENCES integration.external_systems(external_system_id) ON DELETE RESTRICT,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  resource_type varchar(80) NOT NULL,
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'UNDER_REVIEW', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_contract_systems
    CHECK (target_system_id IS NULL OR source_system_id <> target_system_id)
);

CREATE TABLE integration.data_contract_versions (
  data_contract_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_contract_id uuid NOT NULL
    REFERENCES integration.data_contracts(data_contract_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  schema_format_code varchar(30) NOT NULL
    CHECK (schema_format_code IN ('JSON_SCHEMA', 'OPENAPI', 'AVRO', 'CSV_SPEC', 'XML_SCHEMA', 'SQL')),
  schema_document jsonb NOT NULL,
  compatibility_code varchar(20) NOT NULL DEFAULT 'BACKWARD'
    CHECK (compatibility_code IN ('NONE', 'BACKWARD', 'FORWARD', 'FULL')),
  data_classification_code varchar(40) NOT NULL,
  purpose_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_summary text,
  change_summary text NOT NULL,
  content_hash char(64) NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  effective_from timestamptz,
  effective_to timestamptz,
  approved_by_party_id uuid REFERENCES core.parties(party_id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_contract_version_period
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  UNIQUE (data_contract_id, version_no)
);

CREATE TABLE integration.data_contract_fields (
  data_contract_field_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_contract_version_id uuid NOT NULL
    REFERENCES integration.data_contract_versions(data_contract_version_id) ON DELETE CASCADE,
  field_path varchar(240) NOT NULL,
  field_type varchar(80) NOT NULL,
  required boolean NOT NULL DEFAULT false,
  nullable boolean NOT NULL DEFAULT true,
  data_classification_id uuid
    REFERENCES governance.data_classifications(data_classification_id) ON DELETE RESTRICT,
  transformation_rule text,
  validation_rule text,
  example_value jsonb,
  UNIQUE (data_contract_version_id, field_path)
);

CREATE TABLE integration.mapping_sets (
  mapping_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  source_system_id uuid NOT NULL
    REFERENCES integration.external_systems(external_system_id) ON DELETE RESTRICT,
  target_system_id uuid NOT NULL
    REFERENCES integration.external_systems(external_system_id) ON DELETE RESTRICT,
  source_resource_type varchar(80) NOT NULL,
  target_resource_type varchar(80) NOT NULL,
  version_no integer NOT NULL DEFAULT 1 CHECK (version_no > 0),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_mapping_systems CHECK (source_system_id <> target_system_id)
);

CREATE TABLE integration.field_mappings (
  field_mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_set_id uuid NOT NULL
    REFERENCES integration.mapping_sets(mapping_set_id) ON DELETE CASCADE,
  source_field_path varchar(240) NOT NULL,
  target_field_path varchar(240) NOT NULL,
  transformation_expression text,
  default_value jsonb,
  required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (mapping_set_id, source_field_path, target_field_path)
);

CREATE TABLE integration.sync_jobs (
  sync_job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_code varchar(80) NOT NULL UNIQUE,
  integration_connection_id uuid NOT NULL
    REFERENCES integration.integration_connections(integration_connection_id) ON DELETE CASCADE,
  data_contract_id uuid
    REFERENCES integration.data_contracts(data_contract_id) ON DELETE RESTRICT,
  mapping_set_id uuid REFERENCES integration.mapping_sets(mapping_set_id) ON DELETE RESTRICT,
  schedule_expression varchar(120),
  sync_mode_code varchar(20) NOT NULL
    CHECK (sync_mode_code IN ('FULL', 'INCREMENTAL', 'EVENT_DRIVEN', 'MANUAL')),
  checkpoint_strategy_code varchar(30),
  is_enabled boolean NOT NULL DEFAULT false,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  last_success_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE integration.sync_runs (
  sync_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid NOT NULL REFERENCES integration.sync_jobs(sync_job_id) ON DELETE RESTRICT,
  trigger_code varchar(20) NOT NULL
    CHECK (trigger_code IN ('SCHEDULED', 'MANUAL', 'WEBHOOK', 'RETRY')),
  status_code varchar(20) NOT NULL DEFAULT 'RUNNING'
    CHECK (status_code IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  checkpoint_value text,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  records_read bigint NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_created bigint NOT NULL DEFAULT 0 CHECK (records_created >= 0),
  records_updated bigint NOT NULL DEFAULT 0 CHECK (records_updated >= 0),
  records_skipped bigint NOT NULL DEFAULT 0 CHECK (records_skipped >= 0),
  records_failed bigint NOT NULL DEFAULT 0 CHECK (records_failed >= 0),
  correlation_id varchar(120),
  initiated_by_party_id uuid REFERENCES core.parties(party_id),
  CONSTRAINT ck_sync_run_period
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE integration.sync_errors (
  sync_error_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES integration.sync_runs(sync_run_id) ON DELETE CASCADE,
  external_record_key varchar(240),
  internal_resource_type varchar(80),
  internal_resource_id uuid,
  error_code varchar(80) NOT NULL,
  error_message text NOT NULL,
  payload_fingerprint char(64),
  retryable boolean NOT NULL DEFAULT false,
  retry_count smallint NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  resolved_at timestamptz,
  resolution_note text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE integration.outbox_events (
  outbox_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type varchar(80) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(120) NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  payload jsonb NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key varchar(160) NOT NULL UNIQUE,
  correlation_id varchar(120),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text
);

CREATE TABLE integration.inbox_messages (
  inbox_message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_system_id uuid NOT NULL
    REFERENCES integration.external_systems(external_system_id) ON DELETE RESTRICT,
  external_message_id varchar(200) NOT NULL,
  event_type varchar(120) NOT NULL,
  payload_hash char(64) NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz,
  processing_status_code varchar(20) NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status_code IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'DUPLICATE', 'REJECTED', 'FAILED')),
  failure_reason text,
  UNIQUE (external_system_id, external_message_id)
);

CREATE TABLE integration.webhook_subscriptions (
  webhook_subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_system_id uuid NOT NULL
    REFERENCES integration.external_systems(external_system_id) ON DELETE CASCADE,
  event_type varchar(120) NOT NULL,
  callback_url text NOT NULL,
  signing_secret_reference text NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  max_attempts smallint NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  verified_at timestamptz,
  UNIQUE (external_system_id, event_type, callback_url)
);

CREATE TABLE integration.webhook_deliveries (
  webhook_delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_subscription_id uuid NOT NULL
    REFERENCES integration.webhook_subscriptions(webhook_subscription_id) ON DELETE CASCADE,
  outbox_event_id uuid NOT NULL
    REFERENCES integration.outbox_events(outbox_event_id) ON DELETE CASCADE,
  attempt_no smallint NOT NULL CHECK (attempt_no > 0),
  request_sent_at timestamptz,
  response_received_at timestamptz,
  response_status integer CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  response_hash char(64),
  outcome_code varchar(20) NOT NULL
    CHECK (outcome_code IN ('PENDING', 'SUCCEEDED', 'RETRY', 'FAILED')),
  next_attempt_at timestamptz,
  error_message text,
  UNIQUE (webhook_subscription_id, outbox_event_id, attempt_no)
);

CREATE TABLE integration.api_clients (
  api_client_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  external_system_id uuid
    REFERENCES integration.external_systems(external_system_id) ON DELETE RESTRICT,
  client_identifier_hash char(64) NOT NULL UNIQUE,
  secret_reference text NOT NULL,
  allowed_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_ip_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED')),
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_api_client_period CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_connections_system_status
  ON integration.integration_connections(external_system_id, status_code);
CREATE INDEX idx_sync_jobs_due
  ON integration.sync_jobs(next_run_at) WHERE is_enabled;
CREATE INDEX idx_sync_runs_job_time
  ON integration.sync_runs(sync_job_id, started_at DESC);
CREATE INDEX idx_sync_errors_unresolved
  ON integration.sync_errors(sync_run_id, occurred_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_outbox_pending
  ON integration.outbox_events(available_at, occurred_at) WHERE published_at IS NULL;
CREATE INDEX idx_inbox_unprocessed
  ON integration.inbox_messages(received_at) WHERE processed_at IS NULL;
CREATE INDEX idx_webhook_retry
  ON integration.webhook_deliveries(next_attempt_at)
  WHERE outcome_code = 'RETRY';

CREATE TRIGGER trg_external_systems_updated_at
BEFORE UPDATE ON integration.external_systems
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_connections_updated_at
BEFORE UPDATE ON integration.integration_connections
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_contracts_updated_at
BEFORE UPDATE ON integration.data_contracts
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_sync_jobs_updated_at
BEFORE UPDATE ON integration.sync_jobs
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0190_integrations_interoperability')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
