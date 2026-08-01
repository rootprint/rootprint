ALTER TABLE "index_settings" DROP CONSTRAINT "index_settings_trace_index_check";--> statement-breakpoint
ALTER TABLE "index_settings" DROP COLUMN "is_trace_index";--> statement-breakpoint
ALTER TABLE "index_settings" DROP COLUMN "trace_index_id";