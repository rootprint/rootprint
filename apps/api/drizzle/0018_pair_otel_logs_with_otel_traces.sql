-- Custom SQL migration file, put your code below! --

-- Quickwit auto-creates otel-logs-v0_9 and otel-traces-v0_9 for its own OTLP endpoints, so an
-- upgrading deployment already has spans in the paired index. New installs get this from
-- defaultSettings(); this covers the ones that already have a row, where a default can never apply.
UPDATE "index_settings"
SET "trace_index_id" = 'otel-traces-v0_9'
WHERE "index_id" = 'otel-logs-v0_9'
  AND "trace_index_id" IS NULL;
