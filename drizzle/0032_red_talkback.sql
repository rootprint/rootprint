PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_index_settings` (
	`index_id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`visibility` text DEFAULT 'all' NOT NULL,
	`level_field` text DEFAULT 'severity_text' NOT NULL,
	`message_field` text DEFAULT 'body.message' NOT NULL,
	`traceback_field` text,
	`context_fields` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_index_settings`("index_id", "display_name", "visibility", "level_field", "message_field", "traceback_field", "context_fields", "created_at", "updated_at") SELECT "index_id", "display_name", "visibility", "level_field", "message_field", "traceback_field", "context_fields", "created_at", "updated_at" FROM `index_settings`;--> statement-breakpoint
DROP TABLE `index_settings`;--> statement-breakpoint
ALTER TABLE `__new_index_settings` RENAME TO `index_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;