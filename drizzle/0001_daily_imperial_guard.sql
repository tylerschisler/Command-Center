CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`health` text NOT NULL,
	`priority` text NOT NULL,
	`owner_id` text,
	`start_date` text,
	`target_date` text,
	`due_date` text,
	`completed_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	CONSTRAINT "projects_status_check" CHECK("projects"."status" in ('planning','active','on_hold','completed','cancelled')),
	CONSTRAINT "projects_health_check" CHECK("projects"."health" in ('on_track','at_risk','off_track')),
	CONSTRAINT "projects_priority_check" CHECK("projects"."priority" in ('critical','high','medium','low'))
);
--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_archived_at_idx` ON `projects` (`archived_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`owner_id` text,
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
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasks_status_check" CHECK("tasks"."status" in ('not_started','in_progress','waiting','blocked','completed')),
	CONSTRAINT "tasks_priority_check" CHECK("tasks"."priority" in ('critical','high','medium','low')),
	CONSTRAINT "tasks_estimated_effort_check" CHECK("tasks"."estimated_effort" is null or "tasks"."estimated_effort" >= 0)
);
--> statement-breakpoint
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_owner_id_idx` ON `tasks` (`owner_id`);--> statement-breakpoint
CREATE INDEX `tasks_archived_at_idx` ON `tasks` (`archived_at`);