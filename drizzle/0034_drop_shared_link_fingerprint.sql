-- Wipe existing share links: hit content is no longer derivable from
-- log_timestamp/log_fingerprint, and share links have a 30-day TTL.
DELETE FROM `shared_link`;--> statement-breakpoint
ALTER TABLE `shared_link` ADD `hit` text NOT NULL;--> statement-breakpoint
ALTER TABLE `shared_link` DROP COLUMN `log_timestamp`;--> statement-breakpoint
ALTER TABLE `shared_link` DROP COLUMN `log_fingerprint`;