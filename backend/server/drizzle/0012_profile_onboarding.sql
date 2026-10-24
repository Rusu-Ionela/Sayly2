ALTER TABLE "Profile" ADD COLUMN "firstName" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "lastName" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN "profileAnswers" text[] DEFAULT '{}'::text[] NOT NULL;
