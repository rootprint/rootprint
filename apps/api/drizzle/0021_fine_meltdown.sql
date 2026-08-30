CREATE TABLE "alert_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"index_id" text NOT NULL,
	"name" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"condition" jsonb NOT NULL,
	"window_seconds" integer NOT NULL,
	"evaluation_interval_seconds" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alert_rule_window_positive" CHECK ("alert_rule"."window_seconds" > 0),
	CONSTRAINT "alert_rule_evaluation_interval_positive" CHECK ("alert_rule"."evaluation_interval_seconds" > 0)
);
--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_rule_index_name_unique" ON "alert_rule" USING btree ("index_id","name");