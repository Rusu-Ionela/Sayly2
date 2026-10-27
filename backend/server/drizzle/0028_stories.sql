-- Instants (stories) that expire after 24 hours. Additive only, and safe to run more than once.
CREATE TABLE IF NOT EXISTS "Story" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"mediaType" text NOT NULL,
	"mediaUrl" text,
	"textContent" text,
	"durationMs" integer,
	"targetLanguage" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	CONSTRAINT "Story_mediaType_check" CHECK ("mediaType" IN ('PHOTO', 'VOICE', 'TEXT')),
	CONSTRAINT "Story_payload_check" CHECK (("mediaType" = 'TEXT' AND "textContent" IS NOT NULL AND "mediaUrl" IS NULL)
        OR ("mediaType" = 'PHOTO' AND "mediaUrl" IS NOT NULL)
        OR ("mediaType" = 'VOICE' AND "mediaUrl" IS NOT NULL AND "durationMs" > 0))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "Story" ADD CONSTRAINT "Story_targetLanguage_Language_id_fk"
    FOREIGN KEY ("targetLanguage") REFERENCES "public"."Language"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Story_expiresAt_idx" ON "Story" USING btree ("expiresAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Story_user_expiresAt_idx" ON "Story" USING btree ("userId", "expiresAt");
