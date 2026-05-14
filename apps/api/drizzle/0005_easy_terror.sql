CREATE INDEX "ingest_token_index_id" ON "ingest_token" USING btree ("index_id");--> statement-breakpoint
CREATE INDEX "saved_query_index_name" ON "saved_query" USING btree ("index_name");--> statement-breakpoint
CREATE INDEX "search_history_index_name" ON "search_history" USING btree ("index_name");--> statement-breakpoint
CREATE INDEX "share_index_name" ON "share" USING btree ("index_name");--> statement-breakpoint
CREATE INDEX "user_preference_index_name" ON "user_preference" USING btree ("index_name");--> statement-breakpoint
CREATE INDEX "view_index_name" ON "view" USING btree ("index_name");