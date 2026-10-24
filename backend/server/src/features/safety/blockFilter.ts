import { and, eq, notExists, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db } from "../../db/client";
import { blocks } from "../../db/schema";

type UserRef = string | PgColumn;

/** SQL condition: neither user has blocked the other. Each side is an id or a user-id column. */
export function notBlockedBetween(userA: UserRef, userB: UserRef): SQL {
  return notExists(
    db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, userA), eq(blocks.blockedId, userB)),
          and(eq(blocks.blockerId, userB), eq(blocks.blockedId, userA)),
        ),
      ),
  );
}
