CREATE TABLE `project_change_order_transitions` (
	`transition_id` text PRIMARY KEY NOT NULL,
	`change_order_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`action_code` text NOT NULL,
	`actor_role` text NOT NULL,
	`actor_account_id` text NOT NULL,
	`note` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`change_order_id`) REFERENCES `project_change_orders`(`change_order_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_change_order_transitions_sequence_uq` ON `project_change_order_transitions` (`change_order_id`,`sequence`);