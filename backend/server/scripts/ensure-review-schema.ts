import "dotenv/config";

import pg from "pg";

const sql = `
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "authVersion" integer NOT NULL DEFAULT 0;

ALTER TABLE "PasswordResetToken"
  ADD COLUMN IF NOT EXISTS "challengeHash" text,
  ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;

UPDATE "PasswordResetToken"
SET "challengeHash" = "tokenHash"
WHERE "challengeHash" IS NULL;

DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ALTER COLUMN "challengeHash" SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_challengeHash_key"
  ON "PasswordResetToken" ("challengeHash");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx"
  ON "PasswordResetToken" ("tokenHash");

ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_tokenHash_key";
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_tokenHash_unique";

DO $$ BEGIN
  ALTER TABLE "Block" ADD CONSTRAINT "Block_no_self" CHECK ("blockerId" <> "blockedId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Message_history_order_idx"
  ON "Message" ("conversationId", "createdAt" DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "UserLanguage_one_spoken_native_uidx"
  ON "UserLanguage" ("userId")
  WHERE type = 'SPEAKS' AND "proficiencyLevel" = 'NATIVE';

CREATE TABLE IF NOT EXISTS "DirectConversation" (
  "userLowId" text NOT NULL REFERENCES "User"(id),
  "userHighId" text NOT NULL REFERENCES "User"(id),
  "conversationId" text NOT NULL UNIQUE REFERENCES "Conversation"(id),
  PRIMARY KEY ("userLowId", "userHighId"),
  CHECK ("userLowId" < "userHighId")
);

CREATE INDEX IF NOT EXISTS "DirectConversation_conversationId_idx"
  ON "DirectConversation" ("conversationId");

CREATE TABLE IF NOT EXISTS "MediaAsset" (
  id text PRIMARY KEY,
  "ownerId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "storageKey" text NOT NULL UNIQUE,
  "mimeType" text NOT NULL,
  size integer NOT NULL,
  kind text NOT NULL,
  purpose text NOT NULL DEFAULT 'CHAT',
  "conversationId" text REFERENCES "Conversation"(id),
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "MediaAsset_ownerId_idx"
  ON "MediaAsset" ("ownerId");

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "clientMessageId" text;

CREATE UNIQUE INDEX IF NOT EXISTS "Message_senderId_clientMessageId_uidx"
  ON "Message" ("senderId", "clientMessageId")
  WHERE "clientMessageId" IS NOT NULL;

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "discoverable" boolean NOT NULL DEFAULT true;

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "firstName" text;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "lastName" text;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "gender" text;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "profileAnswers" text[] NOT NULL DEFAULT '{}';

-- 0011: stored media paths never carry ?exp=&sig=; indexes make "who shows this file" lookups cheap.
UPDATE "Message" SET "content" = split_part("content", '?', 1) WHERE "type" <> 'TEXT' AND "content" LIKE '/media/files/%?%';
UPDATE "Message" SET "thumbnailUrl" = split_part("thumbnailUrl", '?', 1) WHERE "thumbnailUrl" LIKE '/media/files/%?%';
UPDATE "Profile" SET "profileImageUrl" = split_part("profileImageUrl", '?', 1) WHERE "profileImageUrl" LIKE '/media/files/%?%';
UPDATE "User" SET "photoUrl" = split_part("photoUrl", '?', 1) WHERE "photoUrl" LIKE '/media/files/%?%';
CREATE INDEX IF NOT EXISTS "Message_media_content_idx" ON "Message" ("content") WHERE "type" <> 'TEXT';
CREATE INDEX IF NOT EXISTS "Message_thumbnailUrl_idx" ON "Message" ("thumbnailUrl") WHERE "thumbnailUrl" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Profile_profileImageUrl_idx" ON "Profile" ("profileImageUrl") WHERE "profileImageUrl" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "MessageCorrection" (
  id text PRIMARY KEY,
  "messageId" text NOT NULL REFERENCES "Message"(id) ON DELETE CASCADE,
  "authorId" text NOT NULL REFERENCES "User"(id),
  "correctedText" text NOT NULL,
  note text,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "MessageCorrection_messageId_idx"
  ON "MessageCorrection" ("messageId");

CREATE INDEX IF NOT EXISTS "MessageCorrection_authorId_idx"
  ON "MessageCorrection" ("authorId");

CREATE TABLE IF NOT EXISTS "SavedPhrase" (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "sourceText" text NOT NULL,
  "correctedText" text,
  note text,
  "messageId" text REFERENCES "Message"(id) ON DELETE SET NULL,
  "languageCode" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "SavedPhrase_userId_createdAt_idx"
  ON "SavedPhrase" ("userId", "createdAt" DESC);
`;

async function main() {
  const connectionString = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied review schema upgrades.");
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
