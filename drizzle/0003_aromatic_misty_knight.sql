CREATE TABLE `search_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`index_name` text NOT NULL,
	`query` text DEFAULT '' NOT NULL,
	`time_range` text NOT NULL,
	`filters` text NOT NULL,
	`executed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
