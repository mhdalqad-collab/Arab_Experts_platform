CREATE TABLE `reputation_snapshots` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`composite_score` integer NOT NULL,
	`confidence_score` integer NOT NULL,
	`sample_count` integer NOT NULL,
	`dimensions_json` text NOT NULL,
	`methodology_version` text NOT NULL,
	`generated_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reputation_snapshots_party_uq` ON `reputation_snapshots` (`party_id`);--> statement-breakpoint
CREATE TABLE `review_disputes` (
	`dispute_id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`raised_by_party_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`reason_code` text NOT NULL,
	`statement` text NOT NULL,
	`resolution` text,
	`resolved_by_account_id` text,
	`raised_at` text NOT NULL,
	`resolved_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `project_reviews`(`review_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raised_by_party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_disputes_review_open_uq` ON `review_disputes` (`review_id`);