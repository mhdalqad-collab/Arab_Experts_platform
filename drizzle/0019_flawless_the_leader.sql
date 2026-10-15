CREATE TABLE `project_progress_report_transitions` (
	`transition_id` text PRIMARY KEY NOT NULL,
	`progress_report_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actor_role` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`note` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`progress_report_id`) REFERENCES `project_progress_reports`(`progress_report_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_progress_report_transitions_sequence_uq` ON `project_progress_report_transitions` (`progress_report_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `project_progress_report_versions` (
	`version_id` text PRIMARY KEY NOT NULL,
	`progress_report_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`progress_report_id`) REFERENCES `project_progress_reports`(`progress_report_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_progress_report_versions_revision_uq` ON `project_progress_report_versions` (`progress_report_id`,`revision`);--> statement-breakpoint
CREATE TABLE `project_progress_reports` (
	`progress_report_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`public_code` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`declared_progress` integer NOT NULL,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`current_revision` integer DEFAULT 1 NOT NULL,
	`submitted_by_account_id` text NOT NULL,
	`reviewed_by_account_id` text,
	`created_at` text NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_progress_reports_public_code_uq` ON `project_progress_reports` (`public_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_progress_reports_period_uq` ON `project_progress_reports` (`project_id`,`period_start`,`period_end`);