CREATE TABLE `config` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `execution_log_tags` (
	`execution_log_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	CONSTRAINT `execution_log_tags_pk` PRIMARY KEY(`execution_log_id`, `tag_id`),
	CONSTRAINT `fk_execution_log_tags_execution_log_id_execution_logs_id_fk` FOREIGN KEY (`execution_log_id`) REFERENCES `execution_logs`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_execution_log_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `execution_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`command` text NOT NULL,
	`working_directory` text,
	`context` text,
	`output` text,
	`exit_code` integer,
	`success` integer NOT NULL,
	`duration_ms` integer,
	`skill_name` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fact_tags` (
	`fact_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	CONSTRAINT `fact_tags_pk` PRIMARY KEY(`fact_id`, `tag_id`),
	CONSTRAINT `fk_fact_tags_fact_id_facts_id_fk` FOREIGN KEY (`fact_id`) REFERENCES `facts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_fact_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`content` text NOT NULL,
	`source` text,
	`source_type` text,
	`verified` integer DEFAULT 0 NOT NULL,
	`retrieval_count` integer DEFAULT 0 NOT NULL,
	`last_retrieved_at` text,
	`system_id` text UNIQUE,
	`system_hash` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `resource_tags` (
	`resource_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	CONSTRAINT `resource_tags_pk` PRIMARY KEY(`resource_id`, `tag_id`),
	CONSTRAINT `fk_resource_tags_resource_id_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_resource_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`uri` text NOT NULL,
	`type` text NOT NULL,
	`snapshot` text,
	`snapshot_hash` text,
	`retrieval_method` text,
	`last_verified_at` text,
	`retrieval_count` integer DEFAULT 0 NOT NULL,
	`system_id` text UNIQUE,
	`system_hash` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `skill_facts` (
	`skill_id` integer NOT NULL,
	`fact_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `skill_facts_pk` PRIMARY KEY(`skill_id`, `fact_id`),
	CONSTRAINT `fk_skill_facts_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_skill_facts_fact_id_facts_id_fk` FOREIGN KEY (`fact_id`) REFERENCES `facts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `skill_resources` (
	`skill_id` integer NOT NULL,
	`resource_id` integer NOT NULL,
	`snapshot_hash_at_link` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `skill_resources_pk` PRIMARY KEY(`skill_id`, `resource_id`),
	CONSTRAINT `fk_skill_resources_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_skill_resources_resource_id_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `skill_skills` (
	`skill_id` integer NOT NULL,
	`referenced_skill_id` integer NOT NULL,
	`relation_type` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `skill_skills_pk` PRIMARY KEY(`skill_id`, `referenced_skill_id`),
	CONSTRAINT `fk_skill_skills_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_skill_skills_referenced_skill_id_skills_id_fk` FOREIGN KEY (`referenced_skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `skill_tags` (
	`skill_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	CONSTRAINT `skill_tags_pk` PRIMARY KEY(`skill_id`, `tag_id`),
	CONSTRAINT `fk_skill_tags_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_skill_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
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
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`description` text NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`system_id` text UNIQUE,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `execution_logs_command_idx` ON `execution_logs` (`command`);--> statement-breakpoint
CREATE INDEX `execution_logs_success_idx` ON `execution_logs` (`success`);--> statement-breakpoint
CREATE INDEX `execution_logs_skill_name_idx` ON `execution_logs` (`skill_name`);--> statement-breakpoint
CREATE INDEX `execution_logs_created_at_idx` ON `execution_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `facts_content_idx` ON `facts` (`content`);--> statement-breakpoint
CREATE INDEX `facts_source_type_idx` ON `facts` (`source_type`);--> statement-breakpoint
CREATE INDEX `facts_deleted_at_idx` ON `facts` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `resources_uri_idx` ON `resources` (`uri`);--> statement-breakpoint
CREATE INDEX `resources_type_idx` ON `resources` (`type`);--> statement-breakpoint
CREATE INDEX `resources_deleted_at_idx` ON `resources` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `skills_name_idx` ON `skills` (`name`);--> statement-breakpoint
CREATE INDEX `skills_deleted_at_idx` ON `skills` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `skills_execution_log_id_idx` ON `skills` (`execution_log_id`);
