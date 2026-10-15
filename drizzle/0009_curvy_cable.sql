CREATE TABLE `matching_results` (
	`result_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`candidate_ref` text NOT NULL,
	`candidate_party_id` text,
	`total_score` integer NOT NULL,
	`eligible` integer NOT NULL,
	`component_scores_json` text NOT NULL,
	`contributions_json` text NOT NULL,
	`failed_mandatory_json` text NOT NULL,
	`candidate_snapshot_json` text NOT NULL,
	`rank` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `matching_runs`(`run_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matching_results_run_candidate_uq` ON `matching_results` (`run_id`,`candidate_ref`);--> statement-breakpoint
CREATE TABLE `matching_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`need_id` text NOT NULL,
	`client_party_id` text NOT NULL,
	`fingerprint_version` integer NOT NULL,
	`fingerprint_snapshot_json` text NOT NULL,
	`weights_json` text NOT NULL,
	`mandatory_json` text NOT NULL,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`need_id`) REFERENCES `client_needs`(`need_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `selection_decisions` (
	`decision_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`need_id` text NOT NULL,
	`client_party_id` text NOT NULL,
	`candidate_ref` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'SELECTED' NOT NULL,
	`decided_by_account_id` text NOT NULL,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `matching_runs`(`run_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`need_id`) REFERENCES `client_needs`(`need_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
