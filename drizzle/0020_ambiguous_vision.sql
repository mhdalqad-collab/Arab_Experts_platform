CREATE TABLE `project_deliverable_documents` (
	`deliverable_document_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`deliverable_id` text NOT NULL,
	`document_id` text NOT NULL,
	`submission_revision` integer NOT NULL,
	`linked_by_account_id` text NOT NULL,
	`linked_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `service_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deliverable_id`) REFERENCES `project_deliverables`(`deliverable_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `professional_documents`(`document_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_by_account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_deliverable_documents_document_uq` ON `project_deliverable_documents` (`deliverable_id`,`document_id`);