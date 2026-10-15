CREATE TABLE `backup_records` (
	`id` text PRIMARY KEY NOT NULL,
	`backup_id` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`file_name` text NOT NULL,
	`primary_path` text NOT NULL,
	`secondary_path` text,
	`secondary_status` text NOT NULL,
	`schema_version` integer,
	`database_bytes` integer,
	`error_code` text,
	CONSTRAINT "backup_records_status_check" CHECK("backup_records"."status" in ('running','valid','partial','failed_validation','failed')),
	CONSTRAINT "backup_records_trigger_check" CHECK("backup_records"."trigger" in ('automatic','manual','restore_point')),
	CONSTRAINT "backup_records_secondary_check" CHECK("backup_records"."secondary_status" in ('not_configured','copied','failed'))
);
--> statement-breakpoint
CREATE INDEX `backup_records_created_idx` ON `backup_records` (`created_at`);--> statement-breakpoint
CREATE INDEX `backup_records_status_idx` ON `backup_records` (`status`);--> statement-breakpoint
CREATE TABLE `backup_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`automatic_enabled` integer DEFAULT true NOT NULL,
	`secondary_directory` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intelligence_items` (
	`id` text PRIMARY KEY NOT NULL,
	`headline` text NOT NULL,
	`normalized_headline` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`canonical_url` text NOT NULL,
	`publication_date` text NOT NULL,
	`fetched_at` text NOT NULL,
	`summary` text NOT NULL,
	`relevance_score` integer NOT NULL,
	`why_it_matters` text NOT NULL,
	`topics` text NOT NULL,
	`saved_knowledge_page_id` text,
	FOREIGN KEY (`saved_knowledge_page_id`) REFERENCES `knowledge_pages`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "intelligence_relevance_check" CHECK("intelligence_items"."relevance_score" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intelligence_items_canonical_url_unique` ON `intelligence_items` (`canonical_url`);--> statement-breakpoint
CREATE INDEX `intelligence_publication_idx` ON `intelligence_items` (`publication_date`);--> statement-breakpoint
CREATE INDEX `intelligence_relevance_idx` ON `intelligence_items` (`relevance_score`);--> statement-breakpoint
CREATE INDEX `intelligence_headline_idx` ON `intelligence_items` (`normalized_headline`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`cloud_ai_enabled` integer DEFAULT false NOT NULL,
	`voice_enabled` integer DEFAULT false NOT NULL,
	`stt_enabled` integer DEFAULT true NOT NULL,
	`voice_responses_enabled` integer DEFAULT true NOT NULL,
	`speak_confirmations` integer DEFAULT true NOT NULL,
	`speak_briefings` integer DEFAULT false NOT NULL,
	`speak_long_responses` text DEFAULT 'ask' NOT NULL,
	`automatic_speech_character_limit` integer DEFAULT 280 NOT NULL,
	`monthly_voice_warning_seconds` integer,
	`monthly_cost_warning_micros` integer,
	`monthly_cost_cutoff_micros` integer,
	`hard_cost_cutoff_enabled` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "ai_settings_long_response_check" CHECK("__new_ai_settings"."speak_long_responses" in ('ask','on','off')),
	CONSTRAINT "ai_settings_speech_limit_check" CHECK("__new_ai_settings"."automatic_speech_character_limit" between 80 and 1000),
	CONSTRAINT "ai_settings_voice_warning_check" CHECK("__new_ai_settings"."monthly_voice_warning_seconds" is null or "__new_ai_settings"."monthly_voice_warning_seconds" > 0),
	CONSTRAINT "ai_settings_cost_warning_check" CHECK("__new_ai_settings"."monthly_cost_warning_micros" is null or "__new_ai_settings"."monthly_cost_warning_micros" > 0),
	CONSTRAINT "ai_settings_cost_cutoff_check" CHECK("__new_ai_settings"."monthly_cost_cutoff_micros" is null or "__new_ai_settings"."monthly_cost_cutoff_micros" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_ai_settings`("id", "cloud_ai_enabled", "voice_enabled", "stt_enabled", "voice_responses_enabled", "speak_confirmations", "speak_briefings", "speak_long_responses", "automatic_speech_character_limit", "monthly_voice_warning_seconds", "monthly_cost_warning_micros", "monthly_cost_cutoff_micros", "hard_cost_cutoff_enabled", "updated_at") SELECT "id", "cloud_ai_enabled", "voice_enabled", "stt_enabled", "voice_responses_enabled", "speak_confirmations", "speak_briefings", "speak_long_responses", "automatic_speech_character_limit", "monthly_voice_warning_seconds", null, null, false, "updated_at" FROM `ai_settings`;--> statement-breakpoint
DROP TABLE `ai_settings`;--> statement-breakpoint
ALTER TABLE `__new_ai_settings` RENAME TO `ai_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
