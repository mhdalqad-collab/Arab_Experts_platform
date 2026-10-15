BEGIN;
DROP FUNCTION IF EXISTS integration.run_delivery_slo_job(uuid,uuid,date,varchar);
DROP FUNCTION IF EXISTS communication.queue_delivery_incident_notifications(uuid,uuid,varchar);
DROP TABLE IF EXISTS communication.delivery_incident_notification_links;
DELETE FROM integration.scheduled_job_runs WHERE job_code='COMMUNICATION_DELIVERY_SLO';
DELETE FROM integration.scheduled_job_definitions WHERE job_code='COMMUNICATION_DELIVERY_SLO';
DELETE FROM integration.schema_migrations WHERE migration_name='0890_v113_backend_slo_scheduling_notifications';
COMMIT;
