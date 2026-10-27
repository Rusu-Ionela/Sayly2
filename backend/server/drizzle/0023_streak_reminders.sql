-- Streak reminder push: a per-member opt-out and the day the last reminder went out.
-- Additive only, and safe to run more than once.
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notifyStreakReminders" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "UserStreak" ADD COLUMN IF NOT EXISTS "lastReminderDate" date;
