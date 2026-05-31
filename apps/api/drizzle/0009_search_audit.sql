DROP TABLE IF EXISTS "search_history" CASCADE;--> statement-breakpoint

CREATE TABLE "search_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"executed_at" timestamptz NOT NULL DEFAULT now(),
	"source" text NOT NULL,
	"user_id" text,
	"search_token_id" integer,
	"index_id" text NOT NULL,
	"query" text NOT NULL DEFAULT '',
	"start_ts" bigint,
	"end_ts" bigint,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"num_hits" bigint,
	"error_code" text,
	"error_message" text,
	CONSTRAINT "search_audit_actor_check" CHECK (
		("source" = 'ui'    AND "user_id" IS NOT NULL AND "search_token_id" IS NULL) OR
		("source" = 'token' AND "search_token_id" IS NOT NULL AND "user_id" IS NULL)
	)
);--> statement-breakpoint

CREATE INDEX "search_audit_executed_at"    ON "search_audit" ("executed_at");--> statement-breakpoint
CREATE INDEX "search_audit_user_executed"  ON "search_audit" ("user_id", "executed_at")        WHERE "user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "search_audit_token_executed" ON "search_audit" ("search_token_id", "executed_at") WHERE "search_token_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "search_audit_index_executed" ON "search_audit" ("index_id", "executed_at");
