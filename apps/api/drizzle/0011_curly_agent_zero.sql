ALTER TABLE "user_preference" ADD COLUMN "line_wrap" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "display_mode" text DEFAULT 'table' NOT NULL;