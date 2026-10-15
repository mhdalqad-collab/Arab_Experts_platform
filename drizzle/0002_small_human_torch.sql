CREATE TABLE `account_roles` (
	`account_role_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`role_code` text NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_roles_account_role_uq` ON `account_roles` (`account_id`,`role_code`);--> statement-breakpoint
CREATE TABLE `membership_reviews` (
	`review_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`reviewer_account_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`decision_code` text,
	`decision_reason` text,
	`opened_at` text NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `membership_profiles`(`profile_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `membership_transitions` (
	`transition_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`action_code` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`reason` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `membership_profiles`(`profile_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_transitions_request_uq` ON `membership_transitions` (`request_id`);