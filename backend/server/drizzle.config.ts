import "dotenv/config";

import { defineConfig } from "drizzle-kit";

// Prefer a direct (non-pooled) URL for migrations; DIRECT_URL is the Supabase name for it.
const connectionString =
  process.env.DATABASE_MIGRATE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_MIGRATE_URL, DIRECT_URL or DATABASE_URL for drizzle-kit");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});
