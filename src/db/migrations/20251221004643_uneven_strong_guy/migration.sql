ALTER TABLE `resources` ADD `description` text DEFAULT '[auto-migrated] Needs description' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_skills` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '[auto-migrated] Needs description' NOT NULL,
	`file_path` text NOT NULL,
	`content_hash` text,
	`retrieval_count` integer DEFAULT 0 NOT NULL,
	`last_retrieved_at` text,
	`needs_review` integer DEFAULT 0 NOT NULL,
	`system_id` text UNIQUE,
	`system_hash` text,
	`execution_log_id` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_skills`(`id`, `name`, `title`, `description`, `file_path`, `content_hash`, `retrieval_count`, `last_retrieved_at`, `needs_review`, `system_id`, `system_hash`, `execution_log_id`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `name`, `title`, COALESCE(`description`, '[auto-migrated] Needs description'), `file_path`, `content_hash`, `retrieval_count`, `last_retrieved_at`, `needs_review`, `system_id`, `system_hash`, `execution_log_id`, `created_at`, `updated_at`, `deleted_at` FROM `skills`;--> statement-breakpoint
DROP TABLE `skills`;--> statement-breakpoint
ALTER TABLE `__new_skills` RENAME TO `skills`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `skills_name_idx` ON `skills` (`name`);--> statement-breakpoint
CREATE INDEX `skills_deleted_at_idx` ON `skills` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `skills_execution_log_id_idx` ON `skills` (`execution_log_id`);
