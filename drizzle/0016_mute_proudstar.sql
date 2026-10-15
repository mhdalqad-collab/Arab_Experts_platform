CREATE TABLE `complaint_transitions` (
	`transition_id` text PRIMARY KEY NOT NULL,
	`complaint_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`action_code` text NOT NULL,
	`note` text,
	`actor_account_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`complaint_id`) REFERENCES `quality_complaints`(`complaint_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `complaint_transitions_sequence_uq` ON `complaint_transitions` (`complaint_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `corrective_actions` (
	`corrective_action_id` text PRIMARY KEY NOT NULL,
	`complaint_id` text NOT NULL,
	`action_text` text NOT NULL,
	`owner_account_id` text NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`completion_evidence` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`complaint_id`) REFERENCES `quality_complaints`(`complaint_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quality_complaints` (
	`complaint_id` text PRIMARY KEY NOT NULL,
	`public_code` text NOT NULL,
	`complainant_party_id` text NOT NULL,
	`respondent_party_id` text,
	`project_id` text,
	`review_id` text,
	`category` text NOT NULL,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`subject` text NOT NULL,
	`statement` text NOT NULL,
	`resolution` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`submitted_by_account_id` text NOT NULL,
	`assigned_to_account_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`complainant_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`respondent_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_id`) REFERENCES `project_reviews`(`review_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quality_complaints_public_code_uq` ON `quality_complaints` (`public_code`);