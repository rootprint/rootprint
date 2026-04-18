CREATE TABLE `indexes_meta` (
	`index_id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`visibility` text DEFAULT 'all' NOT NULL,
	`level_field` text DEFAULT 'level' NOT NULL,
	`message_field` text DEFAULT 'message' NOT NULL,
	`traceback_field` text,
	`context_fields` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO indexes_meta (
	index_id, display_name, visibility,
	level_field, message_field, traceback_field, context_fields,
	created_at, updated_at
)
SELECT
	index_id, display_name, visibility,
	level_field, message_field, traceback_field, context_fields,
	created_at, updated_at
FROM qw_index;
