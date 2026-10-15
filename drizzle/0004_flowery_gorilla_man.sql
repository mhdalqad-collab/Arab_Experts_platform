CREATE TABLE `account_party_links` (
	`account_party_link_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`party_id` text NOT NULL,
	`relationship_code` text DEFAULT 'OWNER' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_party_links_account_party_uq` ON `account_party_links` (`account_id`,`party_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`party_id` text PRIMARY KEY NOT NULL,
	`legal_name_ar` text NOT NULL,
	`legal_name_en` text,
	`legal_entity_type` text,
	`registration_number` text,
	`registration_country_code` text,
	`website_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_registration_uq` ON `organizations` (`registration_country_code`,`registration_number`);--> statement-breakpoint
CREATE TABLE `parties` (
	`party_id` text PRIMARY KEY NOT NULL,
	`party_type` text NOT NULL,
	`display_name_ar` text NOT NULL,
	`display_name_en` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`row_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `party_contacts` (
	`party_contact_id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`contact_type` text NOT NULL,
	`contact_value` text NOT NULL,
	`normalized_value` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `party_contacts_party_type_value_uq` ON `party_contacts` (`party_id`,`contact_type`,`normalized_value`);--> statement-breakpoint
CREATE TABLE `party_membership_links` (
	`party_membership_link_id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`account_membership_id` text NOT NULL,
	`relationship_code` text DEFAULT 'OWNER' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_membership_id`) REFERENCES `account_memberships`(`membership_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `party_membership_links_party_membership_uq` ON `party_membership_links` (`party_id`,`account_membership_id`);--> statement-breakpoint
CREATE TABLE `party_privacy_rules` (
	`party_privacy_rule_id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`field_key` text NOT NULL,
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`consent_granted` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `party_privacy_rules_party_field_uq` ON `party_privacy_rules` (`party_id`,`field_key`);--> statement-breakpoint
CREATE TABLE `persons` (
	`party_id` text PRIMARY KEY NOT NULL,
	`full_name_ar` text NOT NULL,
	`full_name_en` text,
	`nationality_country_code` text,
	`residence_country_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
