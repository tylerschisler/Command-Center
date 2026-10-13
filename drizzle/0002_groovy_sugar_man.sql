CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`display_name` text NOT NULL,
	`company_or_team` text,
	`role` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE INDEX `people_display_name_idx` ON `people` (`display_name`);--> statement-breakpoint
CREATE INDEX `people_archived_at_idx` ON `people` (`archived_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`owner_id` text,
	`unresolved_owner_token` text,
	`project_id` text,
	`start_date` text,
	`target_date` text,
	`due_date` text,
	`completed_date` text,
	`recurrence_rule_id` text,
	`estimated_effort` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasks_status_check" CHECK("__new_tasks"."status" in ('not_started','in_progress','waiting','blocked','completed')),
	CONSTRAINT "tasks_priority_check" CHECK("__new_tasks"."priority" in ('critical','high','medium','low')),
	CONSTRAINT "tasks_estimated_effort_check" CHECK("__new_tasks"."estimated_effort" is null or "__new_tasks"."estimated_effort" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "description", "status", "priority", "owner_id", "unresolved_owner_token", "project_id", "start_date", "target_date", "due_date", "completed_date", "recurrence_rule_id", "estimated_effort", "created_at", "updated_at", "archived_at") SELECT "id", "title", "description", "status", "priority", NULL, "owner_id", "project_id", "start_date", "target_date", "due_date", "completed_date", "recurrence_rule_id", "estimated_effort", "created_at", "updated_at", "archived_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_owner_id_idx` ON `tasks` (`owner_id`);--> statement-breakpoint
CREATE INDEX `tasks_unresolved_owner_token_idx` ON `tasks` (`unresolved_owner_token`);--> statement-breakpoint
CREATE INDEX `tasks_archived_at_idx` ON `tasks` (`archived_at`);
--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`requested_from_person_id` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`requested_date` text NOT NULL,
	`due_date` text NOT NULL,
	`follow_up_date` text,
	`received_date` text,
	`closed_date` text,
	`project_id` text,
	`related_task_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`requested_from_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`related_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "requests_status_check" CHECK("requests"."status" in ('draft','requested','acknowledged','waiting','received','closed')),
	CONSTRAINT "requests_priority_check" CHECK("requests"."priority" in ('critical','high','medium','low'))
);
--> statement-breakpoint
CREATE INDEX `requests_person_id_idx` ON `requests` (`requested_from_person_id`);--> statement-breakpoint
CREATE INDEX `requests_project_id_idx` ON `requests` (`project_id`);--> statement-breakpoint
CREATE INDEX `requests_task_id_idx` ON `requests` (`related_task_id`);--> statement-breakpoint
CREATE INDEX `requests_status_idx` ON `requests` (`status`);--> statement-breakpoint
CREATE INDEX `requests_due_date_idx` ON `requests` (`due_date`);--> statement-breakpoint
CREATE INDEX `requests_archived_at_idx` ON `requests` (`archived_at`);
