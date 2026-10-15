CREATE TABLE `membership_profile_versions` (
	`version_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`revision` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`actor_email` text NOT NULL,
	`reason` text DEFAULT 'AUTOSAVE' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `membership_profiles`(`profile_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_profile_versions_profile_revision_uq` ON `membership_profile_versions` (`profile_id`,`revision`);--> statement-breakpoint
CREATE TABLE `membership_profiles` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`membership_code` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`privacy_json` text DEFAULT '{}' NOT NULL,
	`records_json` text DEFAULT '{}' NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`lifecycle_status` text DEFAULT 'draft' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_profiles_account_code_uq` ON `membership_profiles` (`account_id`,`membership_code`);