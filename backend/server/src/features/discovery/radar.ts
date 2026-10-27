import { and, eq, gte, inArray, ne, notExists, or, sql, type SQL } from "drizzle-orm";
import {
  RADAR_ACTIVE_WINDOW_MINUTES,
  RADAR_MAX_PARTNERS,
  type RadarAvailability,
  type RadarDto,
  type RadarLanguageBadge,
  type RadarPartnerDto,
  type RadarRing,
} from "@sayly/shared";

import { db } from "../../db/client";
import { profiles, userSettings, users } from "../../db/schema";
import { listLiveUserIds } from "../../infra/presence/leases";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { resignMediaUrl } from "../media/storage";
import { notBlockedBetween } from "../safety/blockFilter";
import { visibleLocation } from "../users/settings";

import { loadConversationIdsByPartner } from "./repository";
import { intersectGoals, scoreAndDescribe, type LanguageRow } from "./scoring";
import type { MatchType } from "./types";

/** Recently active members are scored in memory; this caps how many we look at. */
const CANDIDATE_POOL = 200;

const RING_BY_MATCH: Record<MatchType, RadarRing> = { MUTUAL: 0, PARTIAL: 1, NONE: 2 };

/** Who is online now, or nobody when Redis cannot be read (the radar then shows "recent" only). */
async function liveUserIds(): Promise<Set<string>> {
  try {
    return new Set(await listLiveUserIds());
  } catch (error) {
    logger.warn("radar", "live presence unavailable", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Set();
  }
}

/**
 * Same visibility as the Discover list, and members who hide their online status never
 * appear: being on the radar reveals that someone is active.
 */
function radarWhere(viewerId: string, liveIds: string[], cutoff: Date): SQL | undefined {
  const active = liveIds.length > 0
    ? or(inArray(users.id, liveIds), gte(users.lastSeenAt, cutoff))
    : gte(users.lastSeenAt, cutoff);
  return and(
    ne(users.id, viewerId),
    eq(users.status, "ACTIVE"),
    eq(users.onboardingCompleted, true),
    eq(profiles.profileCompleted, true),
    eq(profiles.discoverable, true),
    notBlockedBetween(viewerId, users.id),
    notExists(
      db
        .select({ userId: userSettings.userId })
        .from(userSettings)
        .where(and(eq(userSettings.userId, users.id), eq(userSettings.showOnlineStatus, false))),
    ),
    active,
  );
}

type BadgeRow = LanguageRow & { language: LanguageRow["language"] & { flagEmoji: string } };

function badge(row: BadgeRow | undefined): RadarLanguageBadge | null {
  return row ? { languageId: row.languageId, name: row.language.name, flagEmoji: row.language.flagEmoji || null } : null;
}

const AVAILABILITY_ORDER: Record<RadarAvailability, number> = { ONLINE: 0, RECENT: 1 };

/** Closest language fit first (inner ring), then who is online now, then score and recency. */
export function compareRadarPartners(a: RadarPartnerDto, b: RadarPartnerDto): number {
  return (
    a.ring - b.ring ||
    AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability] ||
    b.matchScore - a.matchScore ||
    Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt) ||
    a.id.localeCompare(b.id)
  );
}

/** GET /discover/radar — members active in the last 15 minutes, closest language fit first. */
export async function getRadar(viewerId: string, now: Date = new Date()): Promise<RadarDto> {
  const viewer = await db.query.users.findFirst({
    where: eq(users.id, viewerId),
    columns: { id: true },
    with: {
      profile: { columns: { practiceGoals: true } },
      languages: { columns: { languageId: true, type: true } },
    },
  });
  if (!viewer) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  const viewerSpeaks = new Set(viewer.languages.filter((row) => row.type === "SPEAKS").map((row) => row.languageId));
  const viewerLearns = new Set(viewer.languages.filter((row) => row.type === "LEARNING").map((row) => row.languageId));
  const viewerGoals = viewer.profile?.practiceGoals ?? [];

  const live = await liveUserIds();
  live.delete(viewerId);
  const cutoff = new Date(now.getTime() - RADAR_ACTIVE_WINDOW_MINUTES * 60_000);
  const liveIds = [...live];

  const pool = await db
    .select({ id: users.id, lastSeenAt: users.lastSeenAt })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(radarWhere(viewerId, liveIds, cutoff))
    .orderBy(
      ...(liveIds.length > 0 ? [sql`(${inArray(users.id, liveIds)}) DESC`] : []),
      sql`${users.lastSeenAt} DESC NULLS LAST`,
    )
    .limit(CANDIDATE_POOL);

  if (pool.length === 0) {
    return { items: [], onlineCount: 0, generatedAt: now.toISOString() };
  }

  const ids = pool.map((row) => row.id);
  const lastSeenById = new Map(pool.map((row) => [row.id, row.lastSeenAt]));

  const [candidates, conversationByPartner] = await Promise.all([
    db.query.users.findMany({
      where: inArray(users.id, ids),
      columns: { id: true },
      with: {
        profile: {
          columns: { displayName: true, country: true, city: true, profileImageUrl: true, practiceGoals: true },
        },
        settings: { columns: { showLocation: true } },
        languages: {
          columns: { languageId: true, type: true, proficiencyLevel: true },
          with: { language: { columns: { code: true, name: true, flagEmoji: true } } },
        },
      },
    }),
    loadConversationIdsByPartner(viewerId, ids),
  ]);

  const items: RadarPartnerDto[] = [];
  for (const candidate of candidates) {
    if (!candidate.profile) continue;
    const rows: BadgeRow[] = candidate.languages;
    const sharedGoals = intersectGoals(viewerGoals, candidate.profile.practiceGoals);
    const scored = scoreAndDescribe(viewerSpeaks, viewerLearns, rows, candidate.profile.displayName, sharedGoals);
    const online = live.has(candidate.id);
    const lastSeen = lastSeenById.get(candidate.id);
    const avatar = candidate.profile.profileImageUrl;

    items.push({
      id: candidate.id,
      displayName: candidate.profile.displayName,
      avatarUrl: avatar ? (resignMediaUrl(avatar) ?? avatar) : null,
      country: visibleLocation(candidate.profile, candidate.settings).country,
      availability: online ? "ONLINE" : "RECENT",
      lastActiveAt: (online || !lastSeen ? now : lastSeen).toISOString(),
      ring: RING_BY_MATCH[scored.matchType],
      matchScore: scored.matchScore,
      matchType: scored.matchType,
      matchReason: scored.matchReasons[0] ?? null,
      canTeach: badge(rows.find((row) => row.type === "SPEAKS" && viewerLearns.has(row.languageId))),
      wantsToLearn: badge(rows.find((row) => row.type === "LEARNING" && viewerSpeaks.has(row.languageId))),
      conversationId: conversationByPartner.get(candidate.id) ?? null,
    });
  }

  items.sort(compareRadarPartners);
  const shown = items.slice(0, RADAR_MAX_PARTNERS);
  return {
    items: shown,
    onlineCount: items.filter((item) => item.availability === "ONLINE").length,
    generatedAt: now.toISOString(),
  };
}
