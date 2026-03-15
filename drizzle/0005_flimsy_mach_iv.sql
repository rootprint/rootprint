ALTER TABLE `invite_token` ADD `expires_at` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `invite_token` SET `expires_at` = `created_at` + 172800;