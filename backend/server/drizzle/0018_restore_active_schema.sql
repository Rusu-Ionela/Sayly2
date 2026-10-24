-- Restore the schema that the running application owns.
--
-- 0014_profile_support_references.sql and 0015_learning_preferences.sql were
-- generated but never added to Drizzle's journal.  0017 consequently retired
-- several of their objects even though the application uses them.  This is a
-- forward-only repair: it restores data from the `retired` schema when present
-- and creates the missing objects for databases that applied the normal journal
-- from an empty state.

-- Move enum types before their dependent support table. Dynamic SQL keeps this
-- safe for installations where the `retired` schema has never existed.
DO $$
DECLARE type_name text;
BEGIN
  FOREACH type_name IN ARRAY ARRAY['DevicePlatform', 'SupportTicketKind', 'SupportTicketStatus', 'SupportTopic'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type type
      JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = 'public' AND type.typname = type_name
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM pg_type type
        JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
        WHERE namespace.nspname = 'retired' AND type.typname = type_name
      ) THEN
        EXECUTE format('ALTER TYPE retired.%I SET SCHEMA public', type_name);
      END IF;
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type type JOIN pg_namespace namespace ON namespace.oid = type.typnamespace WHERE namespace.nspname = 'public' AND type.typname = 'DevicePlatform') THEN
    CREATE TYPE "public"."DevicePlatform" AS ENUM('IOS', 'ANDROID', 'WEB');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type type JOIN pg_namespace namespace ON namespace.oid = type.typnamespace WHERE namespace.nspname = 'public' AND type.typname = 'SupportTicketKind') THEN
    CREATE TYPE "public"."SupportTicketKind" AS ENUM('CONTACT', 'FEATURE_REQUEST', 'BUG_REPORT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type type JOIN pg_namespace namespace ON namespace.oid = type.typnamespace WHERE namespace.nspname = 'public' AND type.typname = 'SupportTicketStatus') THEN
    CREATE TYPE "public"."SupportTicketStatus" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type type JOIN pg_namespace namespace ON namespace.oid = type.typnamespace WHERE namespace.nspname = 'public' AND type.typname = 'SupportTopic') THEN
    CREATE TYPE "public"."SupportTopic" AS ENUM('ACCOUNT', 'SECURITY', 'LANGUAGE_EXCHANGE', 'PRO', 'OTHER');
  END IF;
END $$;--> statement-breakpoint

-- 0017 moved populated tables to `retired`; restore both their data and their
-- original constraints/indexes by moving the relation back intact.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ConversationTopic', 'ProfileView', 'SupportTicket'] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL
      AND to_regclass(format('retired.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE retired.%I SET SCHEMA public', table_name);
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ConversationTopic" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "isMain" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp (3) NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ProfileView" (
  "viewerId" text NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade,
  "viewedId" text NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade,
  "viewedAt" timestamp (3) NOT NULL,
  CONSTRAINT "ProfileView_viewerId_viewedId_pk" PRIMARY KEY("viewerId", "viewedId"),
  CONSTRAINT "ProfileView_no_self" CHECK ("ProfileView"."viewerId" <> "ProfileView"."viewedId")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade,
  "kind" "SupportTicketKind" NOT NULL,
  "topic" "SupportTopic",
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "contactEmail" text NOT NULL,
  "appVersion" text,
  "platform" "DevicePlatform",
  "osVersion" text,
  "deviceModel" text,
  "status" "SupportTicketStatus" DEFAULT 'OPEN' NOT NULL,
  "createdAt" timestamp (3) NOT NULL
);--> statement-breakpoint

-- Restore columns that are present in src/db/schema.ts.
ALTER TABLE "Reference" ADD COLUMN IF NOT EXISTS "rating" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "SavedPhrase" ADD COLUMN IF NOT EXISTS "example" text;--> statement-breakpoint
ALTER TABLE "SavedPhrase" ADD COLUMN IF NOT EXISTS "expressionId" text;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "showSaylyId" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "showCertificates" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "translateTo" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "saylyId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "visitorsSeenAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "communicationMethods" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "timeCommitment" text;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "learningSchedule" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "correctionPreference" text;--> statement-breakpoint

-- Existing members receive collision-free IDs from the client/server's public
-- alphabet.  The loop also repairs any duplicate legacy values before creating
-- the unique index.
DO $$
DECLARE user_row record;
DECLARE next_sayly_id text;
DECLARE alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
BEGIN
  FOR user_row IN
    SELECT "id"
    FROM (
      SELECT "id", "saylyId", row_number() OVER (PARTITION BY "saylyId" ORDER BY "id") AS position
      FROM "User"
    ) candidates
    WHERE "saylyId" IS NULL OR position > 1
  LOOP
    LOOP
      SELECT string_agg(
        substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1),
        ''
      )
      INTO next_sayly_id
      FROM generate_series(1, 8);

      EXIT WHEN NOT EXISTS (SELECT 1 FROM "User" WHERE "saylyId" = next_sayly_id);
    END LOOP;

    UPDATE "User" SET "saylyId" = next_sayly_id WHERE "id" = user_row."id";
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "User" ALTER COLUMN "saylyId" SET NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "User_saylyId_unique" ON "User" USING btree ("saylyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ConversationTopic_userId_createdAt_idx" ON "ConversationTopic" USING btree ("userId", "createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationTopic_one_main_uidx" ON "ConversationTopic" USING btree ("userId") WHERE "isMain" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ProfileView_viewedId_viewedAt_idx" ON "ProfileView" USING btree ("viewedId", "viewedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ProfileView_viewerId_viewedAt_idx" ON "ProfileView" USING btree ("viewerId", "viewedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "SupportTicket_userId_createdAt_idx" ON "SupportTicket" USING btree ("userId", "createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "SupportTicket_kind_status_createdAt_idx" ON "SupportTicket" USING btree ("kind", "status", "createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "SavedPhrase_userId_expressionId_uidx" ON "SavedPhrase" USING btree ("userId", "expressionId") WHERE "expressionId" IS NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reference_rating_range') THEN
    ALTER TABLE "Reference" ADD CONSTRAINT "Reference_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
  END IF;
END $$;
