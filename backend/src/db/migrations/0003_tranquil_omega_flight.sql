CREATE TYPE "public"."monitor_status" AS ENUM('active', 'paused', 'unreachable');--> statement-breakpoint
ALTER TABLE "monitors" ALTER COLUMN "threshold" SET DEFAULT 0.01;--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "html_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "text_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "fetcher_tier" smallint;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "element_fingerprint" jsonb;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "status" "monitor_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "diff_html" text;--> statement-breakpoint
CREATE INDEX "idx_monitors_status" ON "monitors" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_snapshots_hash" ON "snapshots" USING btree ("monitor_id","content_hash");