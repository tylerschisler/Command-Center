CREATE TABLE `entity_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "entity_relationships_source_type_check" CHECK("entity_relationships"."source_type" in ('knowledge_page')),
	CONSTRAINT "entity_relationships_target_type_check" CHECK("entity_relationships"."target_type" in ('project','person','meeting','knowledge_page'))
);
--> statement-breakpoint
CREATE INDEX `entity_relationships_source_idx` ON `entity_relationships` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `entity_relationships_target_idx` ON `entity_relationships` (`target_type`,`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `entity_relationships_unique_idx` ON `entity_relationships` (`source_type`,`source_id`,`relationship_type`,`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `knowledge_page_tags` (
	`knowledge_page_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`knowledge_page_id`, `tag_id`),
	FOREIGN KEY (`knowledge_page_id`) REFERENCES `knowledge_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_page_tags_tag_idx` ON `knowledge_page_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `knowledge_page_topics` (
	`knowledge_page_id` text NOT NULL,
	`knowledge_topic_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`knowledge_page_id`, `knowledge_topic_id`),
	FOREIGN KEY (`knowledge_page_id`) REFERENCES `knowledge_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`knowledge_topic_id`) REFERENCES `knowledge_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_page_topics_topic_idx` ON `knowledge_page_topics` (`knowledge_topic_id`);--> statement-breakpoint
CREATE TABLE `knowledge_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`summary` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE INDEX `knowledge_pages_title_idx` ON `knowledge_pages` (`title`);--> statement-breakpoint
CREATE INDEX `knowledge_pages_archived_at_idx` ON `knowledge_pages` (`archived_at`);--> statement-breakpoint
CREATE VIRTUAL TABLE `knowledge_pages_fts` USING fts5(`id` UNINDEXED, `title`, `content`, `summary`, content=`knowledge_pages`, content_rowid=`rowid`);--> statement-breakpoint
CREATE TRIGGER `knowledge_pages_fts_insert` AFTER INSERT ON `knowledge_pages` BEGIN
	INSERT INTO `knowledge_pages_fts` (`rowid`,`id`,`title`,`content`,`summary`) VALUES (new.`rowid`,new.`id`,new.`title`,new.`content`,coalesce(new.`summary`,''));
END;--> statement-breakpoint
CREATE TRIGGER `knowledge_pages_fts_delete` AFTER DELETE ON `knowledge_pages` BEGIN
	INSERT INTO `knowledge_pages_fts` (`knowledge_pages_fts`,`rowid`,`id`,`title`,`content`,`summary`) VALUES ('delete',old.`rowid`,old.`id`,old.`title`,old.`content`,coalesce(old.`summary`,''));
END;--> statement-breakpoint
CREATE TRIGGER `knowledge_pages_fts_update` AFTER UPDATE ON `knowledge_pages` BEGIN
	INSERT INTO `knowledge_pages_fts` (`knowledge_pages_fts`,`rowid`,`id`,`title`,`content`,`summary`) VALUES ('delete',old.`rowid`,old.`id`,old.`title`,old.`content`,coalesce(old.`summary`,''));
	INSERT INTO `knowledge_pages_fts` (`rowid`,`id`,`title`,`content`,`summary`) VALUES (new.`rowid`,new.`id`,new.`title`,new.`content`,coalesce(new.`summary`,''));
END;--> statement-breakpoint
CREATE TABLE `knowledge_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_topics_normalized_name_unique` ON `knowledge_topics` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `knowledge_topics_name_idx` ON `knowledge_topics` (`name`);--> statement-breakpoint
CREATE TABLE `knowledge_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_page_id` text NOT NULL,
	`content` text NOT NULL,
	`change_description` text NOT NULL,
	`changed_by` text NOT NULL,
	`change_source` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`knowledge_page_id`) REFERENCES `knowledge_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "knowledge_versions_source_check" CHECK("knowledge_versions"."change_source" in ('manual','jarvis','voice','import'))
);
--> statement-breakpoint
CREATE INDEX `knowledge_versions_page_idx` ON `knowledge_versions` (`knowledge_page_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_normalized_name_unique` ON `tags` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `tags_name_idx` ON `tags` (`name`);
