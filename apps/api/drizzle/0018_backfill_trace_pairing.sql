-- Custom SQL migration file, put your code below! --

-- Before this release every ingest key wrote spans to one instance-wide index
-- (TRACE_INDEX_ID, default otel-traces-v0_9) and every logs:read actor could
-- query it. Pairing is now per index and per key, so point every existing row at
-- that same index: no live collector loses its span destination and no user loses
-- trace access at migration time. Indexes with no index_settings row fall back to
-- DEFAULT_SETTINGS.traceIndexId, which is the same value.
--
-- OPERATORS: if you had set TRACE_INDEX_ID to anything other than 'otel-traces-v0_9',
-- this backfill points every index and key at the wrong index. After migrating, run:
--   UPDATE index_settings SET trace_index_id = '<your value>';
--   UPDATE api_key        SET trace_index_id = '<your value>';
-- The env var is gone; pairing is now per index, editable under Settings → Indexes.
UPDATE "index_settings" SET "trace_index_id" = 'otel-traces-v0_9';
UPDATE "api_key" SET "trace_index_id" = 'otel-traces-v0_9';
