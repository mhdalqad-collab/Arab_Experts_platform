BEGIN;

CREATE SCHEMA IF NOT EXISTS communication;

CREATE TABLE communication.notification_topics (
  notification_topic_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_code varchar(70) NOT NULL UNIQUE,
  name_ar varchar(180) NOT NULL,
  category_code varchar(24) NOT NULL CHECK (category_code IN ('SECURITY','ACCOUNT','MEMBERSHIP','MATCHING','SERVICE','PROJECT','FINANCE','TRAINING','KNOWLEDGE','MARKETING','PLATFORM')),
  obligation_code varchar(20) NOT NULL CHECK (obligation_code IN ('MANDATORY','TRANSACTIONAL','OPTIONAL')),
  default_priority_code varchar(12) NOT NULL CHECK (default_priority_code IN ('LOW','NORMAL','HIGH','URGENT')),
  allowed_channels jsonb NOT NULL CHECK (jsonb_typeof(allowed_channels) = 'array'),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status_code IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (allowed_channels <> '[]'::jsonb),
  CHECK (category_code NOT IN ('SECURITY','FINANCE') OR obligation_code <> 'OPTIONAL')
);

CREATE TABLE communication.notification_preferences (
  notification_preference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  notification_topic_id uuid NOT NULL REFERENCES communication.notification_topics(notification_topic_id) ON DELETE RESTRICT,
  channel_code varchar(16) NOT NULL CHECK (channel_code IN ('IN_APP','EMAIL','SMS','WHATSAPP','PUSH')),
  enabled boolean NOT NULL DEFAULT true,
  language_code varchar(8) NOT NULL,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone_name varchar(80) NOT NULL DEFAULT 'Asia/Muscat',
  digest_code varchar(16) NOT NULL DEFAULT 'IMMEDIATE' CHECK (digest_code IN ('IMMEDIATE','DAILY','WEEKLY','NONE')),
  consent_record_id uuid REFERENCES governance.consent_records(consent_record_id) ON DELETE RESTRICT,
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (party_id, notification_topic_id, channel_code, effective_from),
  CHECK ((quiet_hours_start IS NULL) = (quiet_hours_end IS NULL)),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (digest_code <> 'NONE' OR NOT enabled)
);

CREATE TABLE communication.message_templates (
  message_template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_topic_id uuid NOT NULL REFERENCES communication.notification_topics(notification_topic_id) ON DELETE RESTRICT,
  template_code varchar(80) NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  channel_code varchar(16) NOT NULL CHECK (channel_code IN ('IN_APP','EMAIL','SMS','WHATSAPP','PUSH')),
  language_code varchar(8) NOT NULL,
  subject_template text,
  body_template text NOT NULL,
  required_variables jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_variables) = 'array'),
  sensitivity_code varchar(20) NOT NULL CHECK (sensitivity_code IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  status_code varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status_code IN ('DRAFT','REVIEW','APPROVED','ACTIVE','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (template_code, version_number, channel_code, language_code),
  CHECK (approved_at IS NULL OR approved_by_party_id IS NOT NULL),
  CHECK (status_code NOT IN ('APPROVED','ACTIVE') OR approved_at IS NOT NULL)
);

CREATE TABLE communication.outbound_messages (
  outbound_message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_topic_id uuid NOT NULL REFERENCES communication.notification_topics(notification_topic_id) ON DELETE RESTRICT,
  message_template_id uuid NOT NULL REFERENCES communication.message_templates(message_template_id) ON DELETE RESTRICT,
  recipient_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  resource_type varchar(80),
  resource_id uuid,
  channel_code varchar(16) NOT NULL CHECK (channel_code IN ('IN_APP','EMAIL','SMS','WHATSAPP','PUSH')),
  priority_code varchar(12) NOT NULL CHECK (priority_code IN ('LOW','NORMAL','HIGH','URGENT')),
  idempotency_key varchar(180) NOT NULL UNIQUE,
  encrypted_payload_reference text NOT NULL,
  payload_hash char(64) NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'QUEUED' CHECK (status_code IN ('QUEUED','DEFERRED','SENDING','SENT','DELIVERED','FAILED','SUPPRESSED','EXPIRED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((resource_type IS NULL) = (resource_id IS NULL)),
  CHECK (expires_at IS NULL OR expires_at > scheduled_at)
);

CREATE TABLE communication.delivery_attempts (
  delivery_attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_message_id uuid NOT NULL REFERENCES communication.outbound_messages(outbound_message_id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  provider_code varchar(60) NOT NULL,
  provider_message_reference text,
  attempted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  outcome_code varchar(20) NOT NULL CHECK (outcome_code IN ('ACCEPTED','DELIVERED','TEMPORARY_FAILURE','PERMANENT_FAILURE','BOUNCED','REJECTED','RATE_LIMITED')),
  response_code varchar(80),
  response_hash char(64),
  next_retry_at timestamptz,
  delivered_at timestamptz,
  UNIQUE (outbound_message_id, attempt_number),
  CHECK (delivered_at IS NULL OR outcome_code = 'DELIVERED'),
  CHECK (next_retry_at IS NULL OR outcome_code IN ('TEMPORARY_FAILURE','RATE_LIMITED'))
);

CREATE TABLE communication.contact_suppressions (
  contact_suppression_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  channel_code varchar(16) NOT NULL CHECK (channel_code IN ('EMAIL','SMS','WHATSAPP','PUSH')),
  contact_endpoint_hash char(64) NOT NULL,
  reason_code varchar(24) NOT NULL CHECK (reason_code IN ('USER_REQUEST','HARD_BOUNCE','INVALID_ENDPOINT','ABUSE_COMPLAINT','LEGAL_RESTRICTION','SECURITY_HOLD')),
  scope_code varchar(20) NOT NULL CHECK (scope_code IN ('MARKETING_ONLY','OPTIONAL_TOPICS','ALL_NON_MANDATORY','ALL')),
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  created_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  evidence_reference text,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (reason_code NOT IN ('LEGAL_RESTRICTION','SECURITY_HOLD') OR evidence_reference IS NOT NULL)
);

CREATE VIEW communication.v_message_delivery_readiness AS
SELECT m.outbound_message_id,
       t.topic_code,
       t.obligation_code,
       m.channel_code,
       CASE
         WHEN m.expires_at IS NOT NULL AND m.expires_at <= clock_timestamp() THEN 'MESSAGE_EXPIRED'
         WHEN mt.status_code <> 'ACTIVE' THEN 'ACTIVE_TEMPLATE_REQUIRED'
         WHEN NOT (t.allowed_channels ? m.channel_code) THEN 'CHANNEL_NOT_ALLOWED_FOR_TOPIC'
         WHEN EXISTS (
           SELECT 1 FROM communication.contact_suppressions s
           WHERE s.party_id = m.recipient_party_id AND s.channel_code = m.channel_code
             AND (s.effective_to IS NULL OR s.effective_to > clock_timestamp())
             AND (s.scope_code = 'ALL' OR (s.scope_code = 'ALL_NON_MANDATORY' AND t.obligation_code <> 'MANDATORY') OR (s.scope_code = 'OPTIONAL_TOPICS' AND t.obligation_code = 'OPTIONAL') OR (s.scope_code = 'MARKETING_ONLY' AND t.category_code = 'MARKETING'))
         ) THEN 'CONTACT_SUPPRESSED'
         WHEN t.obligation_code = 'OPTIONAL' AND NOT EXISTS (
           SELECT 1 FROM communication.notification_preferences p
           WHERE p.party_id = m.recipient_party_id AND p.notification_topic_id = m.notification_topic_id
             AND p.channel_code = m.channel_code AND p.enabled
             AND p.effective_from <= clock_timestamp() AND (p.effective_to IS NULL OR p.effective_to > clock_timestamp())
         ) THEN 'OPTIONAL_CONSENT_REQUIRED'
         WHEN EXISTS (SELECT 1 FROM communication.delivery_attempts a WHERE a.outbound_message_id = m.outbound_message_id AND a.outcome_code = 'DELIVERED') THEN 'DELIVERED'
         ELSE 'READY_TO_DISPATCH'
       END AS readiness_code
FROM communication.outbound_messages m
JOIN communication.notification_topics t ON t.notification_topic_id = m.notification_topic_id
JOIN communication.message_templates mt ON mt.message_template_id = m.message_template_id;

COMMIT;
