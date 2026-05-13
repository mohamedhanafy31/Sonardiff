ALTER TABLE "monitors" ADD COLUMN "threshold" real DEFAULT 0.1;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{"emailNotifications":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "api_token" text;