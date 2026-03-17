CREATE TABLE IF NOT EXISTS `_index_config_backup` AS SELECT * FROM `index_config`;
--> statement-breakpoint
CREATE TABLE `qw_field_mapping` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`index_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`fast` integer,
	`indexed` integer,
	`stored` integer,
	`record` text,
	`tokenizer` text,
	`description` text,
	`expand_dots` integer,
	`properties` text,
	FOREIGN KEY (`index_id`) REFERENCES `qw_index`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qw_field_mapping_index_name` ON `qw_field_mapping` (`index_id`,`name`);--> statement-breakpoint
CREATE INDEX `qw_field_mapping_index_fast` ON `qw_field_mapping` (`index_id`,`fast`);--> statement-breakpoint
CREATE TABLE `qw_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`index_id` text NOT NULL,
	`index_uid` text,
	`index_uri` text,
	`version` text,
	`create_timestamp` integer,
	`timestamp_field` text,
	`partition_key` text,
	`max_num_partitions` integer DEFAULT 0,
	`mode` text,
	`index_field_presence` integer,
	`store_source` integer,
	`store_document_size` integer,
	`doc_mapping_uid` text,
	`tag_fields` text,
	`default_search_fields` text,
	`dynamic_mapping` text,
	`tokenizers` text,
	`indexing_settings` text,
	`ingest_settings` text,
	`retention` text,
	`raw_field_mappings` text,
	`level_field` text DEFAULT 'level' NOT NULL,
	`message_field` text DEFAULT 'message' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qw_index_index_id_unique` ON `qw_index` (`index_id`);--> statement-breakpoint
INSERT INTO `qw_index` (`index_id`, `level_field`, `message_field`, `timestamp_field`)
SELECT `index_name`, `level_field`, `message_field`, `timestamp_field` FROM `_index_config_backup`;
--> statement-breakpoint
DROP TABLE IF EXISTS `_index_config_backup`;
--> statement-breakpoint
CREATE TABLE `qw_source` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`index_id` integer NOT NULL,
	`source_id` text NOT NULL,
	`source_type` text NOT NULL,
	`enabled` integer DEFAULT true,
	`input_format` text,
	`num_pipelines` integer,
	`desired_num_pipelines` integer,
	`max_num_pipelines_per_indexer` integer,
	`version` text,
	`params` text,
	`transform` text,
	FOREIGN KEY (`index_id`) REFERENCES `qw_index`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qw_source_index_source` ON `qw_source` (`index_id`,`source_id`);--> statement-breakpoint
DROP TABLE `index_config`;
