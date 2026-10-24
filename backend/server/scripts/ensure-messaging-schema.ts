import "dotenv/config";

import pg from "pg";

const sql = `
DO $$ BEGIN
  CREATE TYPE "ConversationType" AS ENUM ('DIRECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'MessageType' AND e.enumlabel = 'IMAGE'
  ) THEN
    ALTER TYPE "MessageType" ADD VALUE 'IMAGE';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'MessageType' AND e.enumlabel = 'VOICE'
  ) THEN
    ALTER TYPE "MessageType" ADD VALUE 'VOICE';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'MessageType' AND e.enumlabel = 'VIDEO'
  ) THEN
    ALTER TYPE "MessageType" ADD VALUE 'VIDEO';
  END IF;
END $$;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "durationMs" integer,
  ADD COLUMN IF NOT EXISTS "mimeType" text,
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" text,
  ADD COLUMN IF NOT EXISTS "transcript" text,
  ADD COLUMN IF NOT EXISTS "translatedContent" text,
  ADD COLUMN IF NOT EXISTS "translatedLang" text,
  ADD COLUMN IF NOT EXISTS "caption" text;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamp(3);

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS "lastMessageId" text,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" timestamp(3);

ALTER TABLE "ConversationParticipant"
  ADD COLUMN IF NOT EXISTS "lastMessageAt" timestamp(3);

CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx"
  ON "Conversation" ("lastMessageAt");

CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_lastMessageAt_idx"
  ON "ConversationParticipant" ("userId", "lastMessageAt" DESC);

CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message" ("conversationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Message_unread_conversationId_senderId_idx"
  ON "Message" ("conversationId", "senderId", "status")
  WHERE "status" IN ('SENT', 'DELIVERED');

UPDATE "Conversation" AS c
SET
  "lastMessageId" = latest.id,
  "lastMessageAt" = latest."createdAt"
FROM (
  SELECT DISTINCT ON ("conversationId")
    id,
    "conversationId",
    "createdAt"
  FROM "Message"
  ORDER BY "conversationId", "createdAt" DESC, id DESC
) AS latest
WHERE c.id = latest."conversationId"
  AND c."lastMessageId" IS NULL;

UPDATE "ConversationParticipant" AS p
SET "lastMessageAt" = c."lastMessageAt"
FROM "Conversation" AS c
WHERE p."conversationId" = c.id
  AND p."lastMessageAt" IS NULL
  AND c."lastMessageAt" IS NOT NULL;
`;

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Missing DATABASE_URL (or DIRECT_URL) in backend/server/.env");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(sql);
    console.log("[db] Messaging schema, indexes, and last-message backfill are ready.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
