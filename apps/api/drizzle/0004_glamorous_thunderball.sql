ALTER TABLE "shared_link" RENAME TO "share";--> statement-breakpoint
ALTER TABLE "share" DROP CONSTRAINT "shared_link_code_unique";--> statement-breakpoint
ALTER TABLE "share" DROP CONSTRAINT "shared_link_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_code_unique" UNIQUE("code");