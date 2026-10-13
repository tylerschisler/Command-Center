CREATE TABLE `ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`cloud_ai_enabled` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`request_timestamp` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`estimated_cost_micros` integer,
	CONSTRAINT "ai_usage_token_check" CHECK("ai_usage_records"."input_tokens" >= 0 and "ai_usage_records"."output_tokens" >= 0 and "ai_usage_records"."request_count" > 0)
);
--> statement-breakpoint
CREATE INDEX `ai_usage_timestamp_idx` ON `ai_usage_records` (`request_timestamp`);