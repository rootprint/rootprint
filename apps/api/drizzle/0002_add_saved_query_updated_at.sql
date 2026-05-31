ALTER TABLE "saved_query" DROP COLUMN "is_shared";--> statement-breakpoint
ALTER TABLE "saved_query" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_query_user_index_name_unique" ON "saved_query" USING btree ("user_id","index_name","name");
