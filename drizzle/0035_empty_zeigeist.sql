CREATE TABLE `view` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`index_name` text NOT NULL,
	`name` text NOT NULL,
	`baseline_filter` text DEFAULT '' NOT NULL,
	`columns` text NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `view_user_index` ON `view` (`user_id`,`index_name`);