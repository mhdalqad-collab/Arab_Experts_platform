CREATE TABLE `party_memberships` (
	`party_membership_id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`membership_code` text NOT NULL,
	`lifecycle_status` text DEFAULT 'DRAFT' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`party_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `party_memberships_party_code_uq` ON `party_memberships` (`party_id`,`membership_code`);--> statement-breakpoint
DROP INDEX `membership_profiles_account_code_uq`;--> statement-breakpoint
ALTER TABLE `membership_profiles` ADD `party_id` text REFERENCES parties(party_id);--> statement-breakpoint
UPDATE `membership_profiles`
   SET `party_id` = (
     SELECT `party_id`
       FROM `account_party_links`
      WHERE `account_party_links`.`account_id` = `membership_profiles`.`account_id`
        AND `account_party_links`.`status` = 'ACTIVE'
      ORDER BY `account_party_links`.`is_primary` DESC,
               `account_party_links`.`created_at`
      LIMIT 1
   )
 WHERE `party_id` IS NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `party_memberships` (
  `party_membership_id`, `party_id`, `membership_code`,
  `lifecycle_status`, `is_active`, `created_at`, `updated_at`
)
SELECT l.`party_id` || ':' || m.`membership_code`,
       l.`party_id`, m.`membership_code`, m.`status`,
       m.`is_active`, m.`created_at`, m.`updated_at`
  FROM `account_memberships` m
  JOIN `account_party_links` l ON l.`account_id` = m.`account_id`
 WHERE l.`status` = 'ACTIVE' AND l.`is_primary` = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `membership_profiles_party_code_uq` ON `membership_profiles` (`party_id`,`membership_code`);
