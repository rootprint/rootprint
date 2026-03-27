CREATE TABLE `shared_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`index_name` text NOT NULL,
	`query` text DEFAULT '' NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`log_timestamp` integer NOT NULL,
	`log_fingerprint` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_link_code_unique` ON `shared_link` (`code`);--> statement-breakpoint
CREATE INDEX `shared_link_code` ON `shared_link` (`code`);