ALTER TABLE "index_settings" ADD COLUMN "is_trace_index" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "index_settings" ADD CONSTRAINT "index_settings_trace_index_check" CHECK (NOT "index_settings"."is_trace_index" OR "index_settings"."trace_index_id" IS NULL);--> statement-breakpoint
-- Quickwit auto-creates both otel indexes for its own OTLP endpoints. Materialize their rows so the
-- canonical pairing is real data instead of a runtime default: 0018's UPDATE-based seed cannot reach
-- an index that has no row, and that gap left deleteIndex and saveIndexConfig unable to clear a
-- pairing which only ever existed in code.
INSERT INTO "index_settings" ("index_id", "is_trace_index") VALUES ('otel-traces-v0_9', true)
ON CONFLICT ("index_id") DO UPDATE SET "is_trace_index" = true, "trace_index_id" = NULL;
--> statement-breakpoint
-- DO NOTHING rather than DO UPDATE: an operator who deliberately unpaired otel-logs keeps that choice.
INSERT INTO "index_settings" ("index_id", "trace_index_id") VALUES ('otel-logs-v0_9', 'otel-traces-v0_9')
ON CONFLICT ("index_id") DO NOTHING;
