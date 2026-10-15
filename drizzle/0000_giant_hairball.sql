CREATE TABLE `account_audit_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_email` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `account_memberships` (
	`membership_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`membership_code` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_memberships_account_code_uq` ON `account_memberships` (`account_id`,`membership_code`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`client_type` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_uq` ON `accounts` (`email`);