-- Rework ingest_token: collapse (token_hash + token_prefix) into a single plain-text `token`,
-- and replace nullable `index_allowlist` JSON with a required `index_id` text column.
-- Existing rows cannot be migrated forward: token_hash is irrecoverable to plaintext, and
-- unscoped / multi-index allowlists have no single target index. Drop all rows and rebuild.
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
DROP TABLE `ingest_token`;
--> statement-breakpoint
ALTER TABLE `ingest_token_new` RENAME TO `ingest_token`;
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_name_unique` ON `ingest_token` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_token_unique` ON `ingest_token` (`token`);
--> statement-breakpoint
CREATE INDEX `ingest_token_created_by` ON `ingest_token` (`created_by_user_id`);
