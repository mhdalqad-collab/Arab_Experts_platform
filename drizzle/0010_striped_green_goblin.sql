CREATE TABLE `service_proposal_versions` (
	`version_id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`revision` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `service_proposals`(`proposal_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_proposal_versions_proposal_revision_uq` ON `service_proposal_versions` (`proposal_id`,`revision`);--> statement-breakpoint
CREATE TABLE `service_proposals` (
	`proposal_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`need_id` text NOT NULL,
	`client_party_id` text NOT NULL,
	`provider_party_id` text,
	`public_code` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`response_revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`request_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`need_id`) REFERENCES `client_needs`(`need_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_proposals_request_uq` ON `service_proposals` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_proposals_public_code_uq` ON `service_proposals` (`public_code`);