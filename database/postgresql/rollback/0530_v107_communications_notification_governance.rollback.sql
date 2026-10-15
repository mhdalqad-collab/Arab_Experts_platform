BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM communication.delivery_attempts)
     OR EXISTS (SELECT 1 FROM communication.outbound_messages WHERE status_code IN ('SENT','DELIVERED'))
     OR EXISTS (SELECT 1 FROM communication.contact_suppressions)
     OR EXISTS (SELECT 1 FROM communication.notification_preferences) THEN
    RAISE EXCEPTION 'rollback refused: communication preferences, suppressions, messages, or delivery evidence exists';
  END IF;
END $$;

DROP VIEW IF EXISTS communication.v_message_delivery_readiness;
DROP TABLE IF EXISTS communication.delivery_attempts;
DROP TABLE IF EXISTS communication.outbound_messages;
DROP TABLE IF EXISTS communication.contact_suppressions;
DROP TABLE IF EXISTS communication.message_templates;
DROP TABLE IF EXISTS communication.notification_preferences;
DROP TABLE IF EXISTS communication.notification_topics;
DROP SCHEMA IF EXISTS communication;

COMMIT;
