CREATE TABLE `saved_query` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`index_name` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`query` text DEFAULT '' NOT NULL,
	`time_range` text NOT NULL,
	`filters` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_query_user_index` ON `saved_query` (`user_id`,`index_name`);