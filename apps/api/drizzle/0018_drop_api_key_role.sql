ALTER TABLE "api_key" DROP CONSTRAINT "api_key_role_check";--> statement-breakpoint
DROP INDEX "api_key_role";--> statement-breakpoint
ALTER TABLE "api_key" DROP COLUMN "role";