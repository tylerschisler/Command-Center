CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date_time` text NOT NULL,
	`end_date_time` text NOT NULL,
	`location` text,
	`agenda` text,
	`notes` text,
	`status` text NOT NULL,
	`project_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "meetings_status_check" CHECK("meetings"."status" in ('scheduled','in_progress','completed','cancelled')),
	CONSTRAINT "meetings_time_check" CHECK("meetings"."end_date_time" >= "meetings"."start_date_time")
);
--> statement-breakpoint
CREATE INDEX `meetings_start_idx` ON `meetings` (`start_date_time`);--> statement-breakpoint
CREATE INDEX `meetings_project_id_idx` ON `meetings` (`project_id`);--> statement-breakpoint
CREATE INDEX `meetings_status_idx` ON `meetings` (`status`);--> statement-breakpoint
CREATE INDEX `meetings_archived_at_idx` ON `meetings` (`archived_at`);--> statement-breakpoint
CREATE TABLE `meeting_participants` (
	`meeting_id` text NOT NULL,
	`person_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`meeting_id`, `person_id`),
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_participants_person_idx` ON `meeting_participants` (`person_id`);--> statement-breakpoint
CREATE TABLE `meeting_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_decisions_meeting_idx` ON `meeting_decisions` (`meeting_id`);--> statement-breakpoint
ALTER TABLE `requests` ADD `meeting_id` text REFERENCES meetings(id);--> statement-breakpoint
CREATE INDEX `requests_meeting_id_idx` ON `requests` (`meeting_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `meeting_id` text REFERENCES meetings(id);--> statement-breakpoint
CREATE INDEX `tasks_meeting_id_idx` ON `tasks` (`meeting_id`);
