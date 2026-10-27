-- The Live Language Pulse: Voice Sparks and Flash Quests. Additive only, and safe to run more than once.
CREATE TABLE IF NOT EXISTS "VoiceSpark" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"languageId" text NOT NULL,
	"audioUrl" text NOT NULL,
	"durationMs" integer NOT NULL,
	"replyToId" text,
	"replyToUserId" text,
	"createdAt" timestamp (3) NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	CONSTRAINT "VoiceSpark_duration_check" CHECK ("durationMs" > 0 AND "durationMs" <= 15000)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "VoiceSpark" ADD CONSTRAINT "VoiceSpark_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "VoiceSpark" ADD CONSTRAINT "VoiceSpark_languageId_Language_id_fk"
    FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "VoiceSpark" ADD CONSTRAINT "VoiceSpark_replyToId_VoiceSpark_id_fk"
    FOREIGN KEY ("replyToId") REFERENCES "public"."VoiceSpark"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "VoiceSpark" ADD CONSTRAINT "VoiceSpark_replyToUserId_User_id_fk"
    FOREIGN KEY ("replyToUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "VoiceSpark_expiresAt_idx" ON "VoiceSpark" USING btree ("expiresAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "VoiceSpark_user_createdAt_idx" ON "VoiceSpark" USING btree ("userId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "VoiceSpark_replyToUser_idx" ON "VoiceSpark" USING btree ("replyToUserId", "createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "FlashQuest" (
	"id" text PRIMARY KEY NOT NULL,
	"languageId" text NOT NULL,
	"hostId" text NOT NULL,
	"guestId" text,
	"status" text DEFAULT 'SEARCHING' NOT NULL,
	"promptId" text NOT NULL,
	"challengeId" text NOT NULL,
	"hostWantsConnect" boolean DEFAULT false NOT NULL,
	"guestWantsConnect" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"startedAt" timestamp (3),
	"endsAt" timestamp (3),
	CONSTRAINT "FlashQuest_status_check" CHECK ("status" IN ('SEARCHING', 'ACTIVE', 'CANCELLED')),
	CONSTRAINT "FlashQuest_no_self" CHECK ("guestId" IS NULL OR "guestId" <> "hostId")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "FlashQuest" ADD CONSTRAINT "FlashQuest_languageId_Language_id_fk"
    FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "FlashQuest" ADD CONSTRAINT "FlashQuest_hostId_User_id_fk"
    FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "FlashQuest" ADD CONSTRAINT "FlashQuest_guestId_User_id_fk"
    FOREIGN KEY ("guestId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "FlashQuest_search_idx" ON "FlashQuest" USING btree ("languageId", "status", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "FlashQuest_host_idx" ON "FlashQuest" USING btree ("hostId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "FlashQuest_guest_idx" ON "FlashQuest" USING btree ("guestId", "createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "FlashQuestMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"questId" text NOT NULL,
	"senderId" text NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "FlashQuestMessage" ADD CONSTRAINT "FlashQuestMessage_questId_FlashQuest_id_fk"
    FOREIGN KEY ("questId") REFERENCES "public"."FlashQuest"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "FlashQuestMessage" ADD CONSTRAINT "FlashQuestMessage_senderId_User_id_fk"
    FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "FlashQuestMessage_quest_idx" ON "FlashQuestMessage" USING btree ("questId", "createdAt");
