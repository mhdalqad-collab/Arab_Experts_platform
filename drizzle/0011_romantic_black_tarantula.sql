CREATE TABLE `service_contract_signatures` (
	`signature_id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`party_role` text NOT NULL,
	`party_id` text NOT NULL,
	`account_id` text NOT NULL,
	`declaration` text NOT NULL,
	`signed_at` text NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `service_contracts`(`contract_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_contract_signatures_contract_role_uq` ON `service_contract_signatures` (`contract_id`,`party_role`);--> statement-breakpoint
CREATE TABLE `service_contract_transitions` (
	`transition_id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`revision` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`note` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `service_contracts`(`contract_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_contract_transitions_contract_revision_uq` ON `service_contract_transitions` (`contract_id`,`revision`);--> statement-breakpoint
CREATE TABLE `service_contracts` (
	`contract_id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`request_id` text NOT NULL,
	`client_party_id` text NOT NULL,
	`provider_party_id` text,
	`public_code` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `service_proposals`(`proposal_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`request_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_contracts_proposal_uq` ON `service_contracts` (`proposal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_contracts_public_code_uq` ON `service_contracts` (`public_code`);