-- Retires tables and columns that no code in this repo reads or writes (leftovers from other work).
-- Nothing with data is deleted: tables that still hold rows are moved to the `retired` schema
-- (reversible with ALTER TABLE ... SET SCHEMA public). Only EMPTY tables are dropped.
-- Every step is guarded, so this is a no-op on a database that never had these objects.

-- 1. Old connection requests become follows (idempotent).
--    ACCEPTED = both people follow each other; PENDING = the requester follows the recipient.
DO $$ BEGIN
  IF to_regclass('public."Connection"') IS NOT NULL THEN
    INSERT INTO "Follow" ("followerId", "followeeId", "createdAt")
      SELECT "requesterId", "recipientId", "createdAt" FROM "Connection" WHERE "status" IN ('PENDING', 'ACCEPTED')
      ON CONFLICT DO NOTHING;
    INSERT INTO "Follow" ("followerId", "followeeId", "createdAt")
      SELECT "recipientId", "requesterId", "updatedAt" FROM "Connection" WHERE "status" = 'ACCEPTED'
      ON CONFLICT DO NOTHING;
  END IF;
END $$;--> statement-breakpoint

CREATE SCHEMA IF NOT EXISTS "retired";--> statement-breakpoint

-- 2. Unused tables: empty -> drop, has rows -> move to `retired`.
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['Connection', 'ConversationTopic', 'ProfileView', 'SupportTicket'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n = 0 THEN
        EXECUTE format('DROP TABLE public.%I CASCADE', t);
      ELSE
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA retired', t);
      END IF;
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

-- 3. Their enum types follow the tables: still used -> move, unused -> drop.
DO $$
DECLARE ty text;
BEGIN
  FOREACH ty IN ARRAY ARRAY['ConnectionStatus', 'SupportTicketKind', 'SupportTicketStatus', 'SupportTopic', 'DevicePlatform'] LOOP
    IF to_regtype(format('public.%I', ty)) IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid AND c.relkind = 'r'
        WHERE a.atttypid = to_regtype(format('public.%I', ty)) AND a.attnum > 0 AND NOT a.attisdropped
      ) THEN
        EXECUTE format('ALTER TYPE public.%I SET SCHEMA retired', ty);
      ELSE
        EXECUTE format('DROP TYPE public.%I', ty);
      END IF;
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

-- 4. Unused columns that carry no information (only defaults / NULL).
--    User.saylyId is NOT dropped here: it holds generated values; decide separately.
ALTER TABLE "User" DROP COLUMN IF EXISTS "visitorsSeenAt";--> statement-breakpoint
ALTER TABLE "UserSettings" DROP COLUMN IF EXISTS "showSaylyId";--> statement-breakpoint
ALTER TABLE "UserSettings" DROP COLUMN IF EXISTS "showCertificates";--> statement-breakpoint
ALTER TABLE "UserSettings" DROP COLUMN IF EXISTS "translateTo";--> statement-breakpoint
ALTER TABLE "SavedPhrase" DROP COLUMN IF EXISTS "example";--> statement-breakpoint
ALTER TABLE "SavedPhrase" DROP COLUMN IF EXISTS "expressionId";
