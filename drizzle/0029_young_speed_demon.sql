CREATE TABLE `index_stats_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`index_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`num_docs` integer NOT NULL,
	`size_bytes` integer NOT NULL,
	`uncompressed_bytes` integer NOT NULL,
	`num_splits` integer NOT NULL,
	`min_timestamp` integer,
	`max_timestamp` integer
);
--> statement-breakpoint
CREATE INDEX `index_stats_snapshot_index_captured` ON `index_stats_snapshot` (`index_id`,`captured_at`);