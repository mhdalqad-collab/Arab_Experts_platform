CREATE TABLE `project_invoices` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`project_id` text NOT NULL,
	`public_code` text NOT NULL,
	`status` text DEFAULT 'ISSUED' NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`issued_by_account_id` text NOT NULL,
	`approved_by_account_id` text,
	`issued_at` text NOT NULL,
	`approved_at` text,
	`paid_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `project_payment_schedules`(`schedule_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_invoices_schedule_uq` ON `project_invoices` (`schedule_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_invoices_public_code_uq` ON `project_invoices` (`public_code`);--> statement-breakpoint
CREATE TABLE `project_payment_schedules` (
	`schedule_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`milestone_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`percentage` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'LOCKED' NOT NULL,
	`eligible_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`milestone_id`) REFERENCES `project_milestones`(`milestone_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_payment_schedules_milestone_uq` ON `project_payment_schedules` (`milestone_id`);--> statement-breakpoint
CREATE TABLE `project_payments` (
	`payment_id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`public_code` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`method` text NOT NULL,
	`external_reference` text,
	`status` text DEFAULT 'RECORDED' NOT NULL,
	`recorded_by_account_id` text NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `project_invoices`(`invoice_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_payments_public_code_uq` ON `project_payments` (`public_code`);