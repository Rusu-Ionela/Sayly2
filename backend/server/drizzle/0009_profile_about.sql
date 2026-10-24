ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "topics" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}' NOT NULL;