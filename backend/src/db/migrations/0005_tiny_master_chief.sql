CREATE TABLE "admin_config" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
INSERT INTO admin_config (key, value) VALUES
  ('dom_picker_enabled',   'true'),
  ('discovery_enabled',    'true'),
  ('registration_open',    'true'),
  ('manual_check_enabled', 'true'),
  ('maintenance_mode',     'false'),
  ('maintenance_message',  ''),
  ('free_plan_limit',      '150'),
  ('pro_plan_limit',       '36000')
ON CONFLICT DO NOTHING;