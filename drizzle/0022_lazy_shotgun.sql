CREATE TABLE `ingest_token` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`index_allowlist` text,
	`revoked_at` integer,
	`last_used_at` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_name_unique` ON `ingest_token` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_token_token_hash_unique` ON `ingest_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `ingest_token_created_by` ON `ingest_token` (`created_by_user_id`);