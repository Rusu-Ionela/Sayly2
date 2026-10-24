-- CODE_REVIEW follow-ups: discoverable, corrections, saved phrases
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "discoverable" boolean NOT NULL DEFAULT true;

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
