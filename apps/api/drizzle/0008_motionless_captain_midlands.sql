ALTER TABLE "index_stats_snapshot" ALTER COLUMN "num_docs" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "index_stats_snapshot" ALTER COLUMN "size_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "index_stats_snapshot" ALTER COLUMN "uncompressed_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "index_stats_snapshot" ALTER COLUMN "min_timestamp" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "index_stats_snapshot" ALTER COLUMN "max_timestamp" SET DATA TYPE bigint;