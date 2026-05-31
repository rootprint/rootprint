CREATE TABLE "search_token" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"index_id" text NOT NULL,
	"last_used_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_token_name_unique" UNIQUE("name"),
	CONSTRAINT "search_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "search_token" ADD CONSTRAINT "search_token_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_token_created_by" ON "search_token" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "search_token_index_id" ON "search_token" USING btree ("index_id");