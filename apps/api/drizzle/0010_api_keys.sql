DROP TABLE IF EXISTS "ingest_token" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "search_token" CASCADE;--> statement-breakpoint

CREATE TABLE "api_key" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"role" text NOT NULL,
	"index_id" text NOT NULL,
	"last_used_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT now(),
	CONSTRAINT "api_key_name_unique" UNIQUE ("name"),
	CONSTRAINT "api_key_token_unique" UNIQUE ("token"),
	CONSTRAINT "api_key_role_check" CHECK ("role" IN ('ingest','search')),
	CONSTRAINT "api_key_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE
);--> statement-breakpoint

CREATE INDEX "api_key_created_by" ON "api_key" ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "api_key_index_id"   ON "api_key" ("index_id");--> statement-breakpoint
CREATE INDEX "api_key_role"       ON "api_key" ("role");--> statement-breakpoint

TRUNCATE "search_audit";--> statement-breakpoint
ALTER TABLE "search_audit" RENAME COLUMN "search_token_id" TO "api_key_id";--> statement-breakpoint
ALTER INDEX "search_audit_token_executed" RENAME TO "search_audit_api_key_executed";
