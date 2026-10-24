import { eq } from "drizzle-orm";

import type { Db, DbTransaction } from "./client";
import { users } from "./schema";

/** `.returning()` rows that must exist; a missing one means the database misbehaved. */
export function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) {
    throw new Error(`Database did not return ${label}`);
  }
  return row;
}

/**
 * Locks one user row until the transaction ends. Take this FIRST in any transaction that also
 * locks other rows (e.g. a group), so every flow locks in the same order and cannot deadlock.
 */
export async function lockUser(tx: DbTransaction | Db, userId: string) {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update").limit(1);
}

/** Escapes `%`, `_` and `\` so user text matches literally inside ILIKE. */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
