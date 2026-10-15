ALTER TABLE `account_notifications` ADD `entity_type` text;--> statement-breakpoint
ALTER TABLE `account_notifications` ADD `entity_id` text;--> statement-breakpoint
ALTER TABLE `account_notifications` ADD `action_route` text;--> statement-breakpoint
ALTER TABLE `account_notifications` ADD `priority` text DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_notifications` ADD `due_at` text;