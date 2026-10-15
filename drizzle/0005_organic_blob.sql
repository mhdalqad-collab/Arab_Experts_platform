CREATE TABLE `organization_invitations` (
	`invitation_id` text PRIMARY KEY NOT NULL,
	`organization_party_id` text NOT NULL,
	`invited_email` text NOT NULL,
	`role_code` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`invited_by_account_id` text NOT NULL,
	`accepted_by_account_id` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`responded_at` text,
	`cancelled_at` text,
	FOREIGN KEY (`organization_party_id`) REFERENCES `organizations`(`party_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
