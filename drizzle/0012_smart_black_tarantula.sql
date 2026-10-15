CREATE TABLE `project_change_orders` (
	`change_order_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`public_code` text NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`payload_json` text NOT NULL,
	`requested_by_account_id` text NOT NULL,
	`approved_by_account_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_deliverables` (
	`deliverable_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`milestone_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`submission_json` text DEFAULT '{}' NOT NULL,
	`review_json` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`submitted_at` text,
	`reviewed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`milestone_id`) REFERENCES `project_milestones`(`milestone_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_milestones` (
	`milestone_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`title` text NOT NULL,
	`weight` integer NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`completed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_projects` (
	`project_id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`client_party_id` text NOT NULL,
	`provider_party_id` text,
	`public_code` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `service_contracts`(`contract_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_projects_contract_uq` ON `service_projects` (`contract_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_projects_public_code_uq` ON `service_projects` (`public_code`);