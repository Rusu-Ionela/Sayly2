import "dotenv/config";
import path from "path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/**
 * Apply the checked-in Drizzle journal with normal process error reporting.
 *
 * This deliberately does not import the app configuration: deploying a schema update should
 * require only a direct database connection, not SMTP/JWT/runtime service configuration.
 */
async function main() {
  const connectionString = process.env.DATABASE_MIGRATE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_MIGRATE_URL, DIRECT_URL or DATABASE_URL for migrations");
  }

  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log("[db] Migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[db] Migration failed:", error);
  process.exitCode = 1;
});
