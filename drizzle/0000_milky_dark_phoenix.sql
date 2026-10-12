CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`description` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`source` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_events_entity_idx` ON `activity_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `activity_events_timestamp_idx` ON `activity_events` (`timestamp`);--> statement-breakpoint
CREATE TRIGGER `activity_events_prevent_update`
BEFORE UPDATE ON `activity_events`
BEGIN
	SELECT RAISE(ABORT, 'Activity events are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `activity_events_prevent_delete`
BEFORE DELETE ON `activity_events`
BEGIN
	SELECT RAISE(ABORT, 'Activity events are immutable');
END;
