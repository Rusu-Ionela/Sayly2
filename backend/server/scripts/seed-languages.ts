/**
 * Seed the Language catalog (LANG-001P0).
 * Usage: npx tsx scripts/seed-languages.ts
 */
import "dotenv/config";

import { sql } from "drizzle-orm";

import { closeDb, db } from "../src/db/client";
import { LANGUAGE_CATALOG } from "../src/features/languages/catalog";
import { seedLanguageCatalog } from "../src/features/languages/repository";

async function ensureSortOrderColumn() {
  await db.execute(sql`
    ALTER TABLE "Language" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 9999 NOT NULL
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "Language_sortOrder_idx" ON "Language" USING btree ("sortOrder")
  `);
}

async function main() {
  await ensureSortOrderColumn();
  console.log(`Seeding ${LANGUAGE_CATALOG.length} languages…`);
  const count = await seedLanguageCatalog();
  console.log(`Done. Upserted ${count} languages.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
