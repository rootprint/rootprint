ALTER TABLE "index_settings" ADD COLUMN "trace_id_field" text DEFAULT 'trace_id' NOT NULL;--> statement-breakpoint
ALTER TABLE "index_settings" DROP COLUMN "visibility";