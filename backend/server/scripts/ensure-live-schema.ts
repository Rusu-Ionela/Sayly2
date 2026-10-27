import "dotenv/config";

import { readFileSync } from "fs";
import path from "path";

import pg from "pg";

// Brings a database that skipped drizzle migrations (the live one stops at 0015) up to what
// the code reads. Additive and idempotent only: never drops or rewrites existing data.
const sql = `
-- 0019_onboarding_drafts
CREATE TABLE IF NOT EXISTS "OnboardingDraft" (
  "userId" text PRIMARY KEY NOT NULL
    REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "step" text DEFAULT 'profile' NOT NULL,
  "questionIndex" integer DEFAULT 0 NOT NULL,
  "draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updatedAt" timestamp (3) NOT NULL
);

-- 0025_pro_until
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "proUntil" timestamp (3);
`;

// 0026_live_language_pulse (Voice Sparks, Flash Quests) is idempotent, so it runs as written.
const livePulseSql = readFileSync(
  path.join(__dirname, "..", "drizzle", "0026_live_language_pulse.sql"),
  "utf8",
);

// 0027_group_feed_party_rooms (group feed, Party Rooms) is idempotent too.
const feedAndPartySql = readFileSync(
  path.join(__dirname, "..", "drizzle", "0027_group_feed_party_rooms.sql"),
  "utf8",
);

// 0028_stories (Instants) is idempotent too.
const storiesSql = readFileSync(path.join(__dirname, "..", "drizzle", "0028_stories.sql"), "utf8");

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Missing DATABASE_URL (or DIRECT_URL) in backend/server/.env");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(livePulseSql);
    await client.query(feedAndPartySql);
    await client.query(storiesSql);
    await client.query("COMMIT");
    console.log("[db] OnboardingDraft, User.proUntil, VoiceSpark, FlashQuest, group feed, Party Room and Story tables are ready.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
