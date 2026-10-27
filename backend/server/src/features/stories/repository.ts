import { and, asc, count, eq, gt, inArray, lt, or, type SQL } from "drizzle-orm";

import { db } from "../../db/client";
import { connections, follows, languages, profiles, stories, users } from "../../db/schema";
import { notBlockedBetween } from "../safety/blockFilter";

/** Upper bound on live stories read for one feed; authors are capped again in the service. */
const FEED_ROW_LIMIT = 500;

const storyColumns = {
  id: stories.id,
  userId: stories.userId,
  mediaType: stories.mediaType,
  mediaUrl: stories.mediaUrl,
  textContent: stories.textContent,
  durationMs: stories.durationMs,
  targetLanguage: stories.targetLanguage,
  createdAt: stories.createdAt,
  expiresAt: stories.expiresAt,
  displayName: profiles.displayName,
  profileImageUrl: profiles.profileImageUrl,
  languageName: languages.name,
  flagEmoji: languages.flagEmoji,
};

export type StoryRow = {
  id: string;
  userId: string;
  mediaType: "PHOTO" | "VOICE" | "TEXT";
  mediaUrl: string | null;
  textContent: string | null;
  durationMs: number | null;
  targetLanguage: string;
  createdAt: Date;
  expiresAt: Date;
  displayName: string;
  profileImageUrl: string | null;
  languageName: string;
  flagEmoji: string;
};

export type NewStory = {
  userId: string;
  mediaType: StoryRow["mediaType"];
  mediaUrl: string | null;
  textContent: string | null;
  durationMs: number | null;
  targetLanguage: string;
  createdAt: Date;
  expiresAt: Date;
};

function selectStories() {
  return db
    .select(storyColumns)
    .from(stories)
    .innerJoin(users, eq(users.id, stories.userId))
    .innerJoin(profiles, eq(profiles.userId, stories.userId))
    .innerJoin(languages, eq(languages.id, stories.targetLanguage));
}

const live = (now: Date) => gt(stories.expiresAt, now);
const activeAuthor = () => and(eq(users.status, "ACTIVE"), eq(users.onboardingCompleted, true));

/**
 * SQL condition: the story's author is someone the viewer follows or an accepted connection
 * (either direction). This is who sees a member's stories.
 */
function authorInAudienceOf(viewerId: string): SQL {
  const followees = db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, viewerId));
  const requested = db
    .select({ id: connections.recipientId })
    .from(connections)
    .where(and(eq(connections.requesterId, viewerId), eq(connections.status, "ACCEPTED")));
  const received = db
    .select({ id: connections.requesterId })
    .from(connections)
    .where(and(eq(connections.recipientId, viewerId), eq(connections.status, "ACCEPTED")));
  return or(
    inArray(stories.userId, followees),
    inArray(stories.userId, requested),
    inArray(stories.userId, received),
  ) as SQL;
}

export async function insertStory(values: NewStory): Promise<string> {
  const [row] = await db.insert(stories).values(values).returning({ id: stories.id });
  if (!row) throw new Error("Story was not saved");
  return row.id;
}

export async function countLiveOwnStories(userId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(stories)
    .where(and(eq(stories.userId, userId), live(now)));
  return row?.total ?? 0;
}

export async function findOwnStory(userId: string, id: string, now: Date): Promise<StoryRow | null> {
  const [row] = await selectStories()
    .where(and(eq(stories.id, id), eq(stories.userId, userId), live(now)))
    .limit(1);
  return row ?? null;
}

/** A live story the viewer may see: author active, in the viewer's audience, no block. */
export async function findVisibleStory(viewerId: string, id: string, now: Date): Promise<StoryRow | null> {
  const [row] = await selectStories()
    .where(
      and(
        eq(stories.id, id),
        live(now),
        activeAuthor(),
        authorInAudienceOf(viewerId),
        notBlockedBetween(viewerId, stories.userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The viewer's own live stories, oldest first. */
export async function listOwnLiveStories(userId: string, now: Date): Promise<StoryRow[]> {
  return selectStories()
    .where(and(eq(stories.userId, userId), live(now)))
    .orderBy(asc(stories.createdAt), asc(stories.id));
}

/** Live stories of everyone in the viewer's audience, oldest first. */
export async function listFeedStories(viewerId: string, now: Date): Promise<StoryRow[]> {
  return selectStories()
    .where(
      and(
        live(now),
        activeAuthor(),
        authorInAudienceOf(viewerId),
        notBlockedBetween(viewerId, stories.userId),
      ),
    )
    .orderBy(asc(stories.createdAt), asc(stories.id))
    .limit(FEED_ROW_LIMIT);
}

export async function deleteOwnStory(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(stories)
    .where(and(eq(stories.id, id), eq(stories.userId, userId)))
    .returning({ id: stories.id });
  return deleted.length > 0;
}

/** Removes expired stories; returns every author whose media may now be unused. */
export async function deleteExpiredStories(now: Date): Promise<string[]> {
  const deleted = await db
    .delete(stories)
    .where(lt(stories.expiresAt, now))
    .returning({ userId: stories.userId, mediaUrl: stories.mediaUrl });
  return [...new Set(deleted.filter((row) => row.mediaUrl).map((row) => row.userId))];
}
