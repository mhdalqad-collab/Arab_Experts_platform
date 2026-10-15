CREATE TABLE `project_closures` (
	`closure_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`report_json` text NOT NULL,
	`submitted_by_account_id` text NOT NULL,
	`accepted_by_account_id` text,
	`submitted_at` text NOT NULL,
	`accepted_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_closures_project_uq` ON `project_closures` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_completion_certificates` (
	`certificate_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`closure_id` text NOT NULL,
	`public_code` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`issued_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closure_id`) REFERENCES `project_closures`(`closure_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_completion_certificates_project_uq` ON `project_completion_certificates` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_completion_certificates_code_uq` ON `project_completion_certificates` (`public_code`);--> statement-breakpoint
CREATE TABLE `project_reviews` (
	`review_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`reviewer_party_id` text NOT NULL,
	`subject_party_id` text NOT NULL,
	`reviewer_role` text NOT NULL,
	`scores_json` text NOT NULL,
	`comment` text,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`submitted_by_account_id` text NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_reviews_project_role_uq` ON `project_reviews` (`project_id`,`reviewer_role`);