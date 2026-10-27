import { eq, inArray } from "drizzle-orm";

import { db } from "../../db/client";
import { profiles, pushTokens, userSettings } from "../../db/schema";

import type { PushPlatform } from "./types";

/** Registers a device for the user; a token seen before moves to the latest account. */
export async function savePushToken(userId: string, token: string, platform: PushPlatform) {
  await db
    .insert(pushTokens)
    .values({ token, userId, platform })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId, platform, updatedAt: new Date() },
    });
}

/** Sign-out on a device: only the owner can unregister it. */
export async function removePushToken(userId: string, token: string) {
  const rows = await db
    .select({ userId: pushTokens.userId })
    .from(pushTokens)
    .where(eq(pushTokens.token, token))
    .limit(1);
  if (rows[0]?.userId === userId) {
    await db.delete(pushTokens).where(eq(pushTokens.token, token));
  }
}

export async function deletePushTokens(tokens: string[]) {
  if (tokens.length > 0) {
    await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
  }
}

export async function pushTokensOf(userId: string): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId));
  return rows.map((row) => row.token);
}

/** Every device of each member, for one batched send. */
export async function pushTokensOfMany(userIds: string[]): Promise<{ userId: string; token: string }[]> {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: pushTokens.userId, token: pushTokens.token })
    .from(pushTokens)
    .where(inArray(pushTokens.userId, userIds));
}

export type NotificationPreferences = {
  notifyMessages: boolean;
  notifyConnectionRequests: boolean;
};

/** Missing settings row = defaults (everything on). */
export async function notificationPreferencesOf(userId: string): Promise<NotificationPreferences> {
  const [row] = await db
    .select({
      notifyMessages: userSettings.notifyMessages,
      notifyConnectionRequests: userSettings.notifyConnectionRequests,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row ?? { notifyMessages: true, notifyConnectionRequests: true };
}

export async function displayNameOf(userId: string): Promise<string> {
  const [row] = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row?.displayName?.trim() || "Someone";
}
