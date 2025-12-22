CREATE TABLE `worker_state` (
	`task_name` text PRIMARY KEY,
	`last_run_at` text,
	`last_status` text,
	`last_message` text,
	`items_processed` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
