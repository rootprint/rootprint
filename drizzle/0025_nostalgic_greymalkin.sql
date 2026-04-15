DELETE FROM `ingest_token`;
--> statement-breakpoint
ALTER TABLE `ingest_token` DROP COLUMN `revoked_at`;
