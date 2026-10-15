CREATE TABLE `account_notifications` (
	`notification_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`profile_id` text,
	`notification_type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `membership_profiles`(`profile_id`) ON UPDATE no action ON DELETE no action
);
