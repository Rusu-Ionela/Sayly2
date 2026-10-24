import "dotenv/config";

import pg from "pg";

const sql = `
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" text NOT NULL UNIQUE,
  "expiresAt" timestamp(3) NOT NULL,
  "usedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
  ON "PasswordResetToken" ("userId");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
  ON "PasswordResetToken" ("expiresAt");
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
    console.log("[db] PasswordResetToken table is ready.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
