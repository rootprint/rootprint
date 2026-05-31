CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_settings" (
	"index_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"visibility" text DEFAULT 'all' NOT NULL,
	"level_field" text DEFAULT 'severity_text' NOT NULL,
	"message_field" text DEFAULT 'body.message' NOT NULL,
	"traceback_field" text,
	"context_fields" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_stats_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"index_id" text NOT NULL,
	"captured_at" timestamp NOT NULL,
	"num_docs" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"uncompressed_bytes" integer NOT NULL,
	"num_splits" integer NOT NULL,
	"min_timestamp" integer,
	"max_timestamp" integer
);
--> statement-breakpoint
CREATE TABLE "ingest_token" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"index_id" text NOT NULL,
	"last_used_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingest_token_name_unique" UNIQUE("name"),
	CONSTRAINT "ingest_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "invite_token" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "saved_query" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"index_name" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"query" text DEFAULT '' NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"index_name" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"time_range" jsonb NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"user_id" text NOT NULL,
	"index_name" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"start_time" integer NOT NULL,
	"end_time" integer NOT NULL,
	"hit" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_link_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_preference" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"index_name" text NOT NULL,
	"display_fields" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "view" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"index_name" text NOT NULL,
	"name" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"columns" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_token" ADD CONSTRAINT "ingest_token_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_token" ADD CONSTRAINT "invite_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_query" ADD CONSTRAINT "saved_query_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_link" ADD CONSTRAINT "shared_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view" ADD CONSTRAINT "view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "index_stats_snapshot_index_captured" ON "index_stats_snapshot" USING btree ("index_id","captured_at");--> statement-breakpoint
CREATE INDEX "ingest_token_created_by" ON "ingest_token" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "invite_token_user" ON "invite_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invite_token_expires" ON "invite_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "saved_query_user_index" ON "saved_query" USING btree ("user_id","index_name");--> statement-breakpoint
CREATE INDEX "search_history_user_executed" ON "search_history" USING btree ("user_id","executed_at");--> statement-breakpoint
CREATE INDEX "search_history_user_index_executed" ON "search_history" USING btree ("user_id","index_name","executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_preference_unique" ON "user_preference" USING btree ("user_id","index_name");--> statement-breakpoint
CREATE INDEX "view_user_index" ON "view" USING btree ("user_id","index_name");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");