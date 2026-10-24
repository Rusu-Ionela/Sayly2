import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../db/client";
import type { ProficiencyLevel, UserLanguageType } from "../../db/schema";
import {
  directConversations,
  languages,
  profiles,
  userLanguages,
  userSettings,
  users,
} from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { countryMatchCandidates } from "../users/countries";
import { visibleLocation } from "../users/settings";

import { toDiscoverUserDto } from "./dto";
import {
  compareByMatchScoreDesc,
  LOW_SCORE_CAP,
  MUTUAL_SCORE_FLOOR,
  PARTIAL_SCORE_CAP,
  PARTIAL_SCORE_FLOOR,
  intersectGoals,
  scoreAndDescribe,
  SHARED_GOAL_WEIGHT,
  type LanguageRow,
} from "./scoring";
import type { DiscoverFilters, DiscoverUser } from "./types";
import { notBlockedBetween } from "../safety/blockFilter";
import { currentAge } from "../users/age";
import { escapeIlike } from "../../db/helpers";

const ulSpoken = alias(userLanguages, "disc_ul_spoken");
const ulLearning = alias(userLanguages, "disc_ul_learning");
const ulProficiency = alias(userLanguages, "disc_ul_prof");
const ulSearch = alias(userLanguages, "disc_ul_search");
const langSearch = alias(languages, "disc_lang_search");
const ulRankSpeak = alias(userLanguages, "disc_ul_rank_speak");
const ulRankLearn = alias(userLanguages, "disc_ul_rank_learn");
const ulRankSharedLearn = alias(userLanguages, "disc_ul_rank_shared_learn");
const ulCountTheyTeach = alias(userLanguages, "disc_ul_cnt_they");
const ulCountWeTeach = alias(userLanguages, "disc_ul_cnt_we");
const ulCountSharedLearn = alias(userLanguages, "disc_ul_cnt_shared_learn");
const ulCountSharedSpeak = alias(userLanguages, "disc_ul_cnt_shared_speak");

type UserLanguageAlias = typeof ulSpoken | typeof ulLearning | typeof ulProficiency;

function hasUserLanguage(table: UserLanguageAlias, options: {
  type?: UserLanguageType;
  languageId?: string;
  proficiency?: ProficiencyLevel;
}) {
  const conditions: SQL[] = [eq(table.userId, users.id)];
  if (options.type) {
    conditions.push(eq(table.type, options.type));
  }
  if (options.languageId) {
    conditions.push(eq(table.languageId, options.languageId));
  }
  if (options.proficiency) {
    conditions.push(eq(table.proficiencyLevel, options.proficiency));
  }

  return exists(db.select({ id: table.id }).from(table).where(and(...conditions)));
}

type CountAlias =
  | typeof ulCountTheyTeach
  | typeof ulCountWeTeach
  | typeof ulCountSharedLearn
  | typeof ulCountSharedSpeak;

function overlapCountSql(table: CountAlias, type: UserLanguageType, languageIds: string[]) {
  if (languageIds.length === 0) {
    return sql<number>`0`;
  }

  return sql<number>`coalesce((${db
    .select({ n: count() })
    .from(table)
    .where(
      and(
        eq(table.userId, users.id),
        eq(table.type, type),
        inArray(table.languageId, languageIds),
      ),
    )}), 0)`;
}

/**
 * SQL twin of scoreAndDescribe so OFFSET pages stay ordered by matchScore DESC.
 */
function sharedGoalCountSql(viewerGoals: string[]) {
  if (viewerGoals.length === 0) {
    return sql<number>`0`;
  }
  const viewerArray = sql`ARRAY[${sql.join(viewerGoals.map((goal) => sql`${goal}`), sql`, `)}]::text[]`;
  return sql<number>`cardinality(ARRAY(SELECT unnest(${profiles.practiceGoals}) INTERSECT SELECT unnest(${viewerArray})))`;
}

function matchScoreSql(viewerSpeakIds: string[], viewerLearnIds: string[], viewerGoals: string[]) {
  const theyTeachUs =
    viewerLearnIds.length > 0
      ? exists(
        db
          .select({ id: ulRankSpeak.id })
          .from(ulRankSpeak)
          .where(
            and(
              eq(ulRankSpeak.userId, users.id),
              eq(ulRankSpeak.type, "SPEAKS"),
              inArray(ulRankSpeak.languageId, viewerLearnIds),
            ),
          ),
      )
      : sql`false`;

  const weTeachThem =
    viewerSpeakIds.length > 0
      ? exists(
        db
          .select({ id: ulRankLearn.id })
          .from(ulRankLearn)
          .where(
            and(
              eq(ulRankLearn.userId, users.id),
              eq(ulRankLearn.type, "LEARNING"),
              inArray(ulRankLearn.languageId, viewerSpeakIds),
            ),
          ),
      )
      : sql`false`;

  const sharedLearn =
    viewerLearnIds.length > 0
      ? exists(
        db
          .select({ id: ulRankSharedLearn.id })
          .from(ulRankSharedLearn)
          .where(
            and(
              eq(ulRankSharedLearn.userId, users.id),
              eq(ulRankSharedLearn.type, "LEARNING"),
              inArray(ulRankSharedLearn.languageId, viewerLearnIds),
            ),
          ),
      )
      : sql`false`;

  const theyCount = overlapCountSql(ulCountTheyTeach, "SPEAKS", viewerLearnIds);
  const weCount = overlapCountSql(ulCountWeTeach, "LEARNING", viewerSpeakIds);
  const sharedLearnCount = overlapCountSql(ulCountSharedLearn, "LEARNING", viewerLearnIds);
  const sharedSpeakCount = overlapCountSql(ulCountSharedSpeak, "SPEAKS", viewerSpeakIds);
  const goalBonus = sql`(${SHARED_GOAL_WEIGHT} * ${sharedGoalCountSql(viewerGoals)})`;

  return sql<number>`(
    CASE
      WHEN ${theyTeachUs} AND ${weTeachThem}
        THEN ${MUTUAL_SCORE_FLOOR} + ${theyCount} + ${weCount} + ${goalBonus}
      WHEN ${theyTeachUs} OR ${weTeachThem} OR ${sharedLearn}
        THEN LEAST(
          ${PARTIAL_SCORE_CAP},
          ${PARTIAL_SCORE_FLOOR} + 10 * (${theyCount} + ${weCount}) + 8 * ${sharedLearnCount} + ${goalBonus}
        )
      WHEN ${sharedSpeakCount} > 0
        THEN LEAST(${LOW_SCORE_CAP}, 10 + 8 * ${sharedSpeakCount} + ${goalBonus})
      ELSE 0
    END
  )`;
}

function buildFilterConditions(filters: DiscoverFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.search) {
    const needle = `%${escapeIlike(filters.search)}%`;
    conditions.push(
      or(
        ilike(profiles.displayName, needle),
        exists(
          db
            .select({ id: ulSearch.id })
            .from(ulSearch)
            .innerJoin(langSearch, eq(langSearch.id, ulSearch.languageId))
            .where(
              and(
                eq(ulSearch.userId, users.id),
                or(ilike(langSearch.name, needle), ilike(langSearch.code, needle)),
              ),
            ),
        ),
      ) as SQL,
    );
  }

  if (filters.country) {
    const aliases = countryMatchCandidates(filters.country);
    if (aliases.length > 0) {
      conditions.push(
        or(...aliases.map((value) => sql`lower(${profiles.country}) = ${value}`)) as SQL,
        // Users who hide their location must not be findable by it either.
        notExists(
          db
            .select({ userId: userSettings.userId })
            .from(userSettings)
            .where(and(eq(userSettings.userId, users.id), eq(userSettings.showLocation, false))),
        ),
      );
    }
  }

  const spokenProficiency =
    filters.spokenLanguageId && filters.proficiency ? filters.proficiency : undefined;
  const learningProficiency =
    !filters.spokenLanguageId && filters.learningLanguageId && filters.proficiency
      ? filters.proficiency
      : undefined;

  if (filters.spokenLanguageId) {
    conditions.push(
      hasUserLanguage(ulSpoken, {
        type: "SPEAKS",
        languageId: filters.spokenLanguageId,
        proficiency: spokenProficiency,
      }),
    );
  }

  if (filters.learningLanguageId) {
    conditions.push(
      hasUserLanguage(ulLearning, {
        type: "LEARNING",
        languageId: filters.learningLanguageId,
        proficiency: learningProficiency,
      }),
    );
  }

  if (filters.proficiency && !filters.spokenLanguageId && !filters.learningLanguageId) {
    conditions.push(hasUserLanguage(ulProficiency, { proficiency: filters.proficiency }));
  }

  if (filters.practiceGoal) {
    conditions.push(sql`${filters.practiceGoal} = ANY(${profiles.practiceGoals})`);
  }

  return conditions;
}

function eligibilityWhere(viewerId: string, filters: DiscoverFilters) {
  return and(
    ne(users.id, viewerId),
    eq(users.status, "ACTIVE"),
    eq(users.onboardingCompleted, true),
    eq(profiles.profileCompleted, true),
    eq(profiles.discoverable, true),
    notBlockedBetween(viewerId, users.id),
    ...buildFilterConditions(filters),
  );
}

export async function loadConversationIdsByPartner(
  viewerId: string,
  partnerIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (partnerIds.length === 0) {
    return map;
  }

  const partnersAsHigh = partnerIds.filter((id) => viewerId < id);
  const partnersAsLow = partnerIds.filter((id) => viewerId > id);
  const clauses: SQL[] = [];
  if (partnersAsHigh.length > 0) {
    clauses.push(
      and(
        eq(directConversations.userLowId, viewerId),
        inArray(directConversations.userHighId, partnersAsHigh),
      )!,
    );
  }
  if (partnersAsLow.length > 0) {
    clauses.push(
      and(
        eq(directConversations.userHighId, viewerId),
        inArray(directConversations.userLowId, partnersAsLow),
      )!,
    );
  }
  if (clauses.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      userLowId: directConversations.userLowId,
      userHighId: directConversations.userHighId,
      conversationId: directConversations.conversationId,
    })
    .from(directConversations)
    .where(or(...clauses));

  for (const row of rows) {
    const partnerId = row.userLowId === viewerId ? row.userHighId : row.userLowId;
    map.set(partnerId, row.conversationId);
  }

  return map;
}

export async function discoverPartners(
  viewerId: string,
  filters: DiscoverFilters,
): Promise<{ items: DiscoverUser[]; totalCount: number }> {
  const viewer = await db.query.users.findFirst({
    where: eq(users.id, viewerId),
    columns: { id: true },
    with: {
      profile: { columns: { practiceGoals: true } },
      languages: {
        columns: { languageId: true, type: true },
      },
    },
  });

  if (!viewer) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  const viewerSpeaks = new Set(
    viewer.languages.filter((row) => row.type === "SPEAKS").map((row) => row.languageId),
  );
  const viewerLearns = new Set(
    viewer.languages.filter((row) => row.type === "LEARNING").map((row) => row.languageId),
  );

  const viewerGoals = viewer.profile?.practiceGoals ?? [];
  const score = matchScoreSql([...viewerSpeaks], [...viewerLearns], viewerGoals);
  const whereClause = and(
    eligibilityWhere(viewerId, filters),
    filters.matchType === "MUTUAL" ? sql`${score} >= ${MUTUAL_SCORE_FLOOR}` : undefined,
  );
  const offset = (filters.page - 1) * filters.limit;

  const [countRow] = await db
    .select({ totalCount: count() })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(whereClause);

  const totalCount = Number(countRow?.totalCount ?? 0);
  if (totalCount === 0) {
    return { items: [], totalCount: 0 };
  }

  // OFFSET pagination is fine at current volume. Upgrade to keyset
  // (matchScore, displayName, id) when discovery lists grow into tens of thousands.
  const pageRows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(whereClause)
    .orderBy(desc(score), asc(profiles.displayName), asc(users.id))
    .limit(filters.limit)
    .offset(offset);

  const pageIds = pageRows.map((row) => row.id);
  if (pageIds.length === 0) {
    return { items: [], totalCount };
  }

  const [candidates, conversationByPartner] = await Promise.all([
    db.query.users.findMany({
      where: inArray(users.id, pageIds),
      // PRO-003: never load email / passwordHash / auth metadata for discovery cards.
      columns: {
        id: true,
      },
      with: {
        profile: {
          columns: {
            displayName: true,
            country: true,
            profileImageUrl: true,
            age: true,
            dateOfBirth: true,
            bio: true,
            practiceGoals: true,
          },
        },
        settings: { columns: { showLocation: true } },
        languages: {
          columns: {
            languageId: true,
            type: true,
            proficiencyLevel: true,
          },
          with: {
            language: {
              columns: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    loadConversationIdsByPartner(viewerId, pageIds),
  ]);

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const items: DiscoverUser[] = [];

  for (const id of pageIds) {
    const candidate = byId.get(id);
    if (!candidate?.profile) {
      continue;
    }

    const languageRows = candidate.languages as LanguageRow[];
    const sharedGoals = intersectGoals(viewerGoals, candidate.profile.practiceGoals);
    const scoredMatch = scoreAndDescribe(
      viewerSpeaks,
      viewerLearns,
      languageRows,
      candidate.profile.displayName,
      sharedGoals,
    );

    items.push(
      toDiscoverUserDto({
        id: candidate.id,
        displayName: candidate.profile.displayName,
        country: visibleLocation(candidate.profile, candidate.settings).country,
        profileImageUrl: candidate.profile.profileImageUrl ?? null,
        age: currentAge(candidate.profile),
        bio: candidate.profile.bio ?? "",
        practiceGoals: candidate.profile.practiceGoals,
        sharedGoals,
        spokenLanguages: scoredMatch.spokenLanguages,
        learningLanguages: scoredMatch.learningLanguages,
        conversationId: conversationByPartner.get(candidate.id) ?? null,
        matchScore: scoredMatch.matchScore,
        matchType: scoredMatch.matchType,
        matchLabel: scoredMatch.matchLabel,
        matchReasons: scoredMatch.matchReasons,
      }),
    );
  }

  items.sort(compareByMatchScoreDesc);
  return { items, totalCount };
}
