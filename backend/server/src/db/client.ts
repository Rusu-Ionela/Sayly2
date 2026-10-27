import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "../config/env";
import { logger } from "../shared/utils/logger";

import * as schema from "./schema";

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  connectionTimeoutMillis: 5000,
  // Opening a TLS connection to the hosted pooler costs ~1.5 s, several times a query. Keep
  // idle connections for a while so the first request after a short pause is not slow.
  idleTimeoutMillis: 10 * 60_000,
  statement_timeout: 10_000,
  query_timeout: 12_000,
});

pool.on("error", (error) => {
  logger.error("db", "idle connection error", {
    name: error.name,
    message: "Database connection failed",
  });
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function closeDb() {
  await pool.end();
}

export async function checkDbReady(timeoutMs = 2000): Promise<boolean> {
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("ready timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
