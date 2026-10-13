CREATE TABLE `briefings` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`structured_facts` text NOT NULL,
	`rendered_content` text NOT NULL,
	`generated_at` text NOT NULL,
	`ai_generated` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "briefings_type_check" CHECK("briefings"."type" in ('morning','end_of_day','weekly','custom')),
	CONSTRAINT "briefings_period_check" CHECK("briefings"."period_end" >= "briefings"."period_start"),
	CONSTRAINT "briefings_ai_generated_check" CHECK("briefings"."ai_generated" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `briefings_type_generated_idx` ON `briefings` (`type`,`generated_at`);--> statement-breakpoint
CREATE INDEX `briefings_period_idx` ON `briefings` (`period_start`,`period_end`);