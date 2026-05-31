ALTER TABLE "saved_query" RENAME COLUMN "index_name" TO "index_id";--> statement-breakpoint
ALTER TABLE "search_history" RENAME COLUMN "index_name" TO "index_id";--> statement-breakpoint
ALTER TABLE "share" RENAME COLUMN "index_name" TO "index_id";--> statement-breakpoint
ALTER TABLE "user_preference" RENAME COLUMN "index_name" TO "index_id";--> statement-breakpoint
ALTER TABLE "view" RENAME COLUMN "index_name" TO "index_id";--> statement-breakpoint
DROP INDEX "saved_query_index_name";--> statement-breakpoint
DROP INDEX "search_history_index_name";--> statement-breakpoint
DROP INDEX "share_index_name";--> statement-breakpoint
DROP INDEX "user_preference_index_name";--> statement-breakpoint
DROP INDEX "view_index_name";--> statement-breakpoint
DROP INDEX "saved_query_user_index_name_unique";--> statement-breakpoint
DROP INDEX "search_history_user_index_executed";--> statement-breakpoint
DROP INDEX "user_preference_unique";--> statement-breakpoint
DROP INDEX "view_user_index";--> statement-breakpoint
CREATE INDEX "saved_query_index_id" ON "saved_query" USING btree ("index_id");--> statement-breakpoint
CREATE INDEX "search_history_index_id" ON "search_history" USING btree ("index_id");--> statement-breakpoint
CREATE INDEX "share_index_id" ON "share" USING btree ("index_id");--> statement-breakpoint
CREATE INDEX "user_preference_index_id" ON "user_preference" USING btree ("index_id");--> statement-breakpoint
CREATE INDEX "view_index_id" ON "view" USING btree ("index_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_query_user_index_name_unique" ON "saved_query" USING btree ("user_id","index_id","name");--> statement-breakpoint
CREATE INDEX "search_history_user_index_executed" ON "search_history" USING btree ("user_id","index_id","executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_preference_unique" ON "user_preference" USING btree ("user_id","index_id");--> statement-breakpoint
CREATE INDEX "view_user_index" ON "view" USING btree ("user_id","index_id");