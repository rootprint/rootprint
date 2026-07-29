ALTER TABLE "api_key" ADD COLUMN "trace_index_id" text;--> statement-breakpoint
ALTER TABLE "index_settings" ADD COLUMN "trace_index_id" text;--> statement-breakpoint
ALTER TABLE "index_settings" ADD COLUMN "trace_id_field" text DEFAULT 'trace_id' NOT NULL;