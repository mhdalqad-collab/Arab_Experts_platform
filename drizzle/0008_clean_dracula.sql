CREATE TABLE `client_need_versions` (
	`version_id` text PRIMARY KEY NOT NULL,
	`need_id` text NOT NULL,
	`revision` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`need_id`) REFERENCES `client_needs`(`need_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_need_versions_need_revision_uq` ON `client_need_versions` (`need_id`,`revision`);--> statement-breakpoint
CREATE TABLE `client_needs` (
	`need_id` text PRIMARY KEY NOT NULL,
	`client_party_id` text NOT NULL,
	`public_code` text NOT NULL,
	`title` text NOT NULL,
	`output_type` text,
	`service_type` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`fingerprint_json` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_request_transitions` (
	`transition_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`request_key` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`note` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`request_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_request_transitions_request_key_uq` ON `service_request_transitions` (`request_id`,`request_key`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`request_id` text PRIMARY KEY NOT NULL,
	`need_id` text NOT NULL,
	`client_party_id` text NOT NULL,
	`provider_party_id` text,
	`candidate_ref` text NOT NULL,
	`public_code` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`need_id`) REFERENCES `client_needs`(`need_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_requests_need_candidate_active_uq` ON `service_requests` (`need_id`,`candidate_ref`);