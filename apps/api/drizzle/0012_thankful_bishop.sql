DROP INDEX "view_user_index";--> statement-breakpoint
ALTER TABLE "view" ALTER COLUMN "columns" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "view" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "view" ADD COLUMN "filters" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "view" ADD COLUMN "sort_direction" text DEFAULT 'desc' NOT NULL;--> statement-breakpoint
ALTER TABLE "view" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
INSERT INTO "view" (user_id, index_id, name, description, query, filters, sort_direction, columns, created_at, updated_at)
SELECT user_id, index_id, name, description, query, '[]'::jsonb, 'desc', NULL, created_at, updated_at
FROM "saved_query";
--> statement-breakpoint
ALTER TABLE "saved_query" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "saved_query" CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "view_user_index_name_unique" ON "view" USING btree ("user_id","index_id","name");
