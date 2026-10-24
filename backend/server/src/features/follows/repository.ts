import { and, count, desc, eq } from "drizzle-orm";

import { db } from "../../db/client";
import { follows, users } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { notBlockedBetween } from "../safety/blockFilter";
import { isBlockedEitherWay } from "../safety/repository";
import { loadMemberSummaries, type MemberSummaryDto } from "../users/memberSummary";

export const FOLLOWING_PAGE_SIZE = 30;

/** A member card (languages, online status) plus when you followed them. */
export type FollowingPerson = MemberSummaryDto & { followedAt: string };

export type FollowingPage = { items: FollowingPerson[]; page: number; hasMore: boolean };

/** Follows of `followerId` whose followee is active and not blocked either way. */
function liveFollowsOf(followerId: string) {
  return and(
    eq(follows.followerId, followerId),
    eq(users.status, "ACTIVE"),
    notBlockedBetween(followerId, follows.followeeId),
  );
}

/** 404 for missing, inactive or blocking users so clients cannot probe block relationships. */
async function assertCanFollow(followerId: string, targetId: string) {
  if (followerId === targetId) {
    throw new AppError("You cannot follow yourself", 400, "VALIDATION_ERROR");
  }

  const [target] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (target?.status !== "ACTIVE" || (await isBlockedEitherWay(followerId, targetId))) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
}

export async function followUser(followerId: string, targetId: string) {
  await assertCanFollow(followerId, targetId);
  await db.insert(follows).values({ followerId, followeeId: targetId }).onConflictDoNothing();
  return { following: true as const };
}

export async function unfollowUser(followerId: string, targetId: string) {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, targetId)));
  return { following: false as const };
}

export async function isFollowing(followerId: string, targetId: string) {
  const [row] = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, targetId)))
    .limit(1);
  return Boolean(row);
}

/** How many active members `userId` follows (shown on your profile). */
export async function countFollowing(userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(liveFollowsOf(userId));
  return row?.total ?? 0;
}

export async function countFollowers(userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(and(eq(follows.followeeId, userId), eq(users.status, "ACTIVE")));
  return row?.total ?? 0;
}

export async function listFollowing(userId: string, page: number): Promise<FollowingPage> {
  const rows = await db
    .select({ id: follows.followeeId, followedAt: follows.createdAt })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(liveFollowsOf(userId))
    .orderBy(desc(follows.createdAt), desc(follows.followeeId))
    .limit(FOLLOWING_PAGE_SIZE + 1)
    .offset((page - 1) * FOLLOWING_PAGE_SIZE);

  const pageRows = rows.slice(0, FOLLOWING_PAGE_SIZE);
  const members = await loadMemberSummaries(pageRows.map((row) => row.id));
  return {
    // Members who are not onboarded have no card and are left out.
    items: pageRows.flatMap((row) => {
      const member = members.get(row.id);
      return member ? [{ ...member, followedAt: row.followedAt.toISOString() }] : [];
    }),
    page,
    hasMore: rows.length > FOLLOWING_PAGE_SIZE,
  };
}
