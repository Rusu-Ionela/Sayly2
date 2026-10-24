import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/client";
import { users } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { resignMediaUrl } from "../media/storage";
import { getPresenceMany } from "../messaging/presence";
import { isBlockedEitherWay } from "../safety/repository";

import { visibleLocation } from "./settings";
import type { OnlineStatus } from "./types";

type LanguageBadge = { name: string; flagEmoji: string };

/** Compact, privacy-safe card of another member (Following, Visitors, Viewed profiles). */
export type MemberSummaryDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** "" / null when the member hides their location. */
  country: string;
  city: string | null;
  isPro: boolean;
  nativeLanguage: LanguageBadge | null;
  learningLanguage: LanguageBadge | null;
  /** UNKNOWN when the member hides their online status. */
  onlineStatus: OnlineStatus;
  lastSeen: string | null;
};

/**
 * Summaries of active, onboarded members, keyed by id. Missing ids (deleted, suspended,
 * not onboarded) are simply absent — callers drop those rows.
 */
export async function loadMemberSummaries(userIds: string[]): Promise<Map<string, MemberSummaryDto>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db.query.users.findMany({
    where: and(inArray(users.id, ids), eq(users.status, "ACTIVE"), eq(users.onboardingCompleted, true)),
    columns: { id: true, isPro: true, lastSeenAt: true },
    with: {
      profile: { columns: { displayName: true, country: true, city: true, profileImageUrl: true } },
      settings: { columns: { showLocation: true } },
      languages: {
        columns: { type: true, proficiencyLevel: true },
        with: { language: { columns: { name: true, flagEmoji: true } } },
      },
    },
  });

  const presence = await getPresenceMany(
    rows.map((row) => ({ userId: row.id, persistedLastSeen: row.lastSeenAt })),
  );

  const summaries = new Map<string, MemberSummaryDto>();
  for (const row of rows) {
    if (!row.profile) continue;
    const location = visibleLocation(row.profile, row.settings);
    const native =
      row.languages.find((item) => item.type === "SPEAKS" && item.proficiencyLevel === "NATIVE") ??
      row.languages.find((item) => item.type === "SPEAKS");
    const learning = row.languages.find((item) => item.type === "LEARNING");
    const snapshot = presence.get(row.id);
    const avatar = row.profile.profileImageUrl;

    summaries.set(row.id, {
      id: row.id,
      displayName: row.profile.displayName,
      avatarUrl: avatar ? (resignMediaUrl(avatar) ?? avatar) : null,
      country: location.country,
      city: location.city,
      isPro: row.isPro,
      nativeLanguage: native ? native.language : null,
      learningLanguage: learning ? learning.language : null,
      onlineStatus: snapshot?.onlineStatus ?? "UNKNOWN",
      lastSeen: snapshot?.lastSeen ?? null,
    });
  }
  return summaries;
}

/**
 * Light PRO-001 visibility gate for actions on another member (follow, open shared
 * link): not yourself, active, onboarded, no block either way. Every miss is a 404.
 */
export async function assertVisibleMember(viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    throw new AppError("This is your own profile", 400, "BAD_REQUEST");
  }
  const [target, blocked] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, targetId),
      columns: { status: true, onboardingCompleted: true },
    }),
    isBlockedEitherWay(viewerId, targetId),
  ]);
  if (!target || target.status !== "ACTIVE" || !target.onboardingCompleted || blocked) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
}
