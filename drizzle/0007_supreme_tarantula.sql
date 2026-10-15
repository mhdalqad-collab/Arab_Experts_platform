CREATE TABLE `document_verifications` (
	`verification_id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`submitted_by_account_id` text NOT NULL,
	`reviewer_account_id` text,
	`confidence_score` integer,
	`decision_reason` text,
	`submitted_at` text NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`document_id`) REFERENCES `professional_documents`(`document_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `professional_document_versions` (
	`document_version_id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`storage_object_key` text NOT NULL,
	`original_file_name` text NOT NULL,
	`media_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256_hash` text NOT NULL,
	`scan_status` text DEFAULT 'PENDING' NOT NULL,
	`uploaded_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `professional_documents`(`document_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_document_versions_document_version_uq` ON `professional_document_versions` (`document_id`,`version_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `professional_document_versions_party_hash_guard_uq` ON `professional_document_versions` (`document_id`,`sha256_hash`);--> statement-breakpoint
CREATE TABLE `professional_documents` (
	`document_id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`membership_code` text,
	`category_code` text NOT NULL,
	`title` text NOT NULL,
	`confidentiality` text DEFAULT 'PRIVATE' NOT NULL,
	`verification_status` text DEFAULT 'NOT_SUBMITTED' NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_documents_party_hash_uq` ON `professional_documents` (`party_id`,`document_id`);