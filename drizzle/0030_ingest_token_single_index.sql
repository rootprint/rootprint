-- Rework ingest_token scoping: index_allowlist (nullable JSON array) -> index_id (NOT NULL text).
-- Any row with NULL allowlist (unscoped) or len > 1 (multi-index) fails the INSERT below via NOT NULL.
-- Operator resolution: delete or split the offending tokens, then rerun.

ALTER TABLE `ingest_token` ADD COLUMN `index_id` text;
--> statement-breakpoint
UPDATE `ingest_token`
SET `index_id` = json_extract(`index_allowlist`, '$[0]')
WHERE `index_allowlist` IS NOT NULL
  AND json_array_length(`index_allowlist`) = 1;
--> statement-breakpoint
CREATE TABLE `ingest_token_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`index_id` text NOT NULL,
	`last_used_at` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `ingest_token_new` (
	`id`, `name`, `token_hash`, `token_prefix`, `index_id`, `last_used_at`, `created_by_user_id`, `created_at`
)
SELECT
	`id`, `name`, `token_hash`, `token_prefix`, `index_id`, `last_used_at`, `created_by_user_id`, `created_at`
FROM `ingest_token`;
--> statement-breakpoint
DROP TABLE `ingest_token`;
--> statement-breakpoint
ALTER TABLE `ingest_token_new` RENAME TO `ingest_token`;
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_name_unique` ON `ingest_token` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_token_hash_unique` ON `ingest_token` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `ingest_token_created_by` ON `ingest_token` (`created_by_user_id`);
