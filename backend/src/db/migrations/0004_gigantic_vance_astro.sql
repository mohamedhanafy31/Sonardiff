CREATE TABLE "monitor_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "monitor_groups" ADD CONSTRAINT "monitor_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_monitor_groups_user" ON "monitor_groups" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_group_id_monitor_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."monitor_groups"("id") ON DELETE set null ON UPDATE no action;