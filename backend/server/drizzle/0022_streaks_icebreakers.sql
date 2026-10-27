-- Daily streaks and the daily icebreaker. Additive only, and safe to run more than once.
CREATE TABLE IF NOT EXISTS "UserStreak" (
	"userId" text PRIMARY KEY NOT NULL,
	"currentStreak" integer DEFAULT 0 NOT NULL,
	"longestStreak" integer DEFAULT 0 NOT NULL,
	"lastActiveDate" date,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "UserStreak_counts_check" CHECK ("currentStreak" >= 0 AND "longestStreak" >= "currentStreak")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "UserStreak" ADD CONSTRAINT "UserStreak_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "IcebreakerAnswer" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"languageId" text NOT NULL,
	"promptDate" date NOT NULL,
	"promptId" text NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "IcebreakerAnswer" ADD CONSTRAINT "IcebreakerAnswer_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "IcebreakerAnswer" ADD CONSTRAINT "IcebreakerAnswer_languageId_Language_id_fk"
    FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "IcebreakerAnswer_userId_languageId_promptDate_key"
  ON "IcebreakerAnswer" USING btree ("userId", "languageId", "promptDate");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IcebreakerAnswer_feed_idx"
  ON "IcebreakerAnswer" USING btree ("languageId", "promptDate", "createdAt", "id");
