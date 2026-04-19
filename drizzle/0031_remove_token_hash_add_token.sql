-- Replace token_hash + token_prefix columns with a single plain-text token column.
-- Table is emptied first so the NOT NULL constraint is satisfiable during the INSERT/SELECT.
DELETE FROM `ingest_token`;
--> statement-breakpoint
CREATE TABLE `ingest_token_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`index_id` text NOT NULL,
	`last_used_at` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- No-op: table was emptied above; kept to preserve drizzle-kit's rename-and-swap pattern.
INSERT INTO `ingest_token_new` (
	`id`, `name`, `token`, `index_id`, `last_used_at`, `created_by_user_id`, `created_at`
)
SELECT
	`id`, `name`, `token_hash`, `index_id`, `last_used_at`, `created_by_user_id`, `created_at`
FROM `ingest_token`;
--> statement-breakpoint
DROP TABLE `ingest_token`;
--> statement-breakpoint
ALTER TABLE `ingest_token_new` RENAME TO `ingest_token`;
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_name_unique` ON `ingest_token` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_token_unique` ON `ingest_token` (`token`);
--> statement-breakpoint
CREATE INDEX `ingest_token_created_by` ON `ingest_token` (`created_by_user_id`);
