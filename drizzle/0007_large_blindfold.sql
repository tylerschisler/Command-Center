CREATE TABLE `voice_usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`request_timestamp` text NOT NULL,
	`audio_duration_ms` integer,
	`input_characters` integer,
	`output_bytes` integer,
	`estimated_cost_micros` integer,
	CONSTRAINT "voice_usage_kind_check" CHECK("voice_usage_records"."kind" in ('transcription','speech')),
	CONSTRAINT "voice_usage_values_check" CHECK(("voice_usage_records"."audio_duration_ms" is null or "voice_usage_records"."audio_duration_ms" >= 0) and ("voice_usage_records"."input_characters" is null or "voice_usage_records"."input_characters" >= 0) and ("voice_usage_records"."output_bytes" is null or "voice_usage_records"."output_bytes" >= 0))
);
--> statement-breakpoint
CREATE INDEX `voice_usage_timestamp_idx` ON `voice_usage_records` (`request_timestamp`);--> statement-breakpoint
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
	`updated_at` text NOT NULL,
	CONSTRAINT "ai_settings_long_response_check" CHECK("__new_ai_settings"."speak_long_responses" in ('ask','on','off')),
	CONSTRAINT "ai_settings_speech_limit_check" CHECK("__new_ai_settings"."automatic_speech_character_limit" between 80 and 1000),
	CONSTRAINT "ai_settings_voice_warning_check" CHECK("__new_ai_settings"."monthly_voice_warning_seconds" is null or "__new_ai_settings"."monthly_voice_warning_seconds" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_ai_settings`("id", "cloud_ai_enabled", "updated_at") SELECT "id", "cloud_ai_enabled", "updated_at" FROM `ai_settings`;--> statement-breakpoint
DROP TABLE `ai_settings`;--> statement-breakpoint
ALTER TABLE `__new_ai_settings` RENAME TO `ai_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
