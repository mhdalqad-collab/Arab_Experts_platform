CREATE TABLE `project_register_items` (
	`register_item_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`public_code` text NOT NULL,
	`item_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`status` text NOT NULL,
	`owner_role` text NOT NULL,
	`due_date` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`raised_by_account_id` text NOT NULL,
	`closed_by_account_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raised_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_register_items_public_code_uq` ON `project_register_items` (`public_code`);--> statement-breakpoint
CREATE TABLE `project_register_transitions` (
	`transition_id` text PRIMARY KEY NOT NULL,
	`register_item_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actor_role` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`note` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`register_item_id`) REFERENCES `project_register_items`(`register_item_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_register_transitions_sequence_uq` ON `project_register_transitions` (`register_item_id`,`sequence`);