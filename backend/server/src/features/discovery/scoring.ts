import type { ProficiencyLevel, UserLanguageType } from "../../db/schema";

import type { DiscoverLanguage, MatchType } from "./types";

export type LanguageRow = {
  languageId: string;
  type: UserLanguageType;
  proficiencyLevel: ProficiencyLevel;
  language: { code: string; name: string; id?: string };
};

export const MUTUAL_SCORE_FLOOR = 100;
export const PARTIAL_SCORE_FLOOR = 50;
export const PARTIAL_SCORE_CAP = 99;
export const LOW_SCORE_CAP = 49;

function idsOf(rows: LanguageRow[], type: UserLanguageType) {
  return new Set(rows.filter((row) => row.type === type).map((row) => row.languageId));
}

function toDiscoverLanguages(rows: LanguageRow[], type: UserLanguageType): DiscoverLanguage[] {
  return rows
    .filter((row) => row.type === type)
    .map((row) => ({
      languageId: row.languageId,
      code: row.language.code,
      name: row.language.name,
      proficiency: row.proficiencyLevel,
    }));
}

function intersectionSize(a: Set<string>, b: Set<string>) {
  let count = 0;
  for (const id of a) {
    if (b.has(id)) count += 1;
  }
  return count;
}

function firstLanguage(rows: LanguageRow[], type: UserLanguageType, preferredIds?: Set<string>) {
  const matched = preferredIds
    ? rows.find((row) => row.type === type && preferredIds.has(row.languageId))
    : undefined;
  return matched ?? rows.find((row) => row.type === type);
}

function formatProficiency(level: ProficiencyLevel) {
  return level
    .toLowerCase()
    .split("_")
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildMatchLabel(
  displayName: string,
  candidateRows: LanguageRow[],
  viewerSpeaks: Set<string>,
  viewerLearns: Set<string>,
): string {
  const spokenForViewer =
    firstLanguage(candidateRows, "SPEAKS", viewerLearns) ??
    firstLanguage(candidateRows, "SPEAKS");
  const learningForViewer =
    firstLanguage(candidateRows, "LEARNING", viewerSpeaks) ??
    firstLanguage(candidateRows, "LEARNING");

  const spokenName = spokenForViewer?.language.name ?? "a language";
  const spokenLevel = spokenForViewer
    ? formatProficiency(spokenForViewer.proficiencyLevel)
    : "Unknown";
  const learningName = learningForViewer?.language.name ?? "another language";

  return `${displayName} speaks ${spokenName} (${spokenLevel}) and wants to learn ${learningName}`;
}

/** Shared interests only reorder partners inside a band; they never promote a band. */
export const SHARED_GOAL_WEIGHT = 1;

type MatchContext = {
  displayName: string;
  candidateRows: LanguageRow[];
  viewerSpeaks: Set<string>;
  viewerLearns: Set<string>;
  sharedGoals: string[];
};

/**
 * Explainable reasons, one rule per signal. Add a rule here to surface a new
 * criterion without touching scoring or the SQL twin.
 */
const MATCH_REASON_RULES: ((ctx: MatchContext) => string | null)[] = [
  ({ candidateRows, viewerLearns }) => {
    const row = candidateRows.find((r) => r.type === "SPEAKS" && viewerLearns.has(r.languageId));
    if (!row) return null;
    const level = row.proficiencyLevel === "NATIVE" ? "native" : formatProficiency(row.proficiencyLevel).toLowerCase();
    return `Speaks ${row.language.name} (${level}), which you're learning`;
  },
  ({ candidateRows, viewerSpeaks }) => {
    const row = candidateRows.find((r) => r.type === "LEARNING" && viewerSpeaks.has(r.languageId));
    return row ? `Wants to learn ${row.language.name}, which you speak` : null;
  },
  ({ candidateRows, viewerLearns, viewerSpeaks }) => {
    const row = candidateRows.find(
      (r) => r.type === "LEARNING" && viewerLearns.has(r.languageId) && !viewerSpeaks.has(r.languageId),
    );
    return row ? `Also learning ${row.language.name}` : null;
  },
  ({ sharedGoals }) =>
    sharedGoals.length > 0 ? `Both want to practice ${sharedGoals.slice(0, 2).join(" & ").toLowerCase()}` : null,
];

export function intersectGoals(viewerGoals: Iterable<string>, candidateGoals: string[]) {
  const viewer = new Set(viewerGoals);
  return candidateGoals.filter((goal) => viewer.has(goal));
}

/**
 * DISC-005 deterministic language-overlap scoring.
 * MUTUAL >= 100, PARTIAL 50–99, NONE < 50. Shared goals add a small in-band bonus.
 */
export function scoreAndDescribe(
  viewerSpeaks: Set<string>,
  viewerLearns: Set<string>,
  candidateRows: LanguageRow[],
  displayName: string,
  sharedGoals: string[] = [],
) {
  const candidateSpeaks = idsOf(candidateRows, "SPEAKS");
  const candidateLearns = idsOf(candidateRows, "LEARNING");

  const theyTeachUs = intersectionSize(candidateSpeaks, viewerLearns);
  const weTeachThem = intersectionSize(viewerSpeaks, candidateLearns);
  const sharedLearn = intersectionSize(viewerLearns, candidateLearns);
  const sharedSpeak = intersectionSize(viewerSpeaks, candidateSpeaks);
  const goalBonus = SHARED_GOAL_WEIGHT * sharedGoals.length;

  const isMutual = theyTeachUs > 0 && weTeachThem > 0;
  const isPartial = !isMutual && (theyTeachUs > 0 || weTeachThem > 0 || sharedLearn > 0);

  let matchScore: number;
  let matchType: MatchType;

  if (isMutual) {
    matchType = "MUTUAL";
    matchScore = MUTUAL_SCORE_FLOOR + theyTeachUs + weTeachThem + goalBonus;
  } else if (isPartial) {
    matchType = "PARTIAL";
    matchScore = Math.min(
      PARTIAL_SCORE_CAP,
      PARTIAL_SCORE_FLOOR + 10 * (theyTeachUs + weTeachThem) + 8 * sharedLearn + goalBonus,
    );
  } else {
    matchType = "NONE";
    matchScore = sharedSpeak > 0 ? Math.min(LOW_SCORE_CAP, 10 + 8 * sharedSpeak + goalBonus) : 0;
  }

  const ctx: MatchContext = { displayName, candidateRows, viewerSpeaks, viewerLearns, sharedGoals };

  return {
    matchScore,
    matchType,
    matchLabel: buildMatchLabel(displayName, candidateRows, viewerSpeaks, viewerLearns),
    matchReasons: MATCH_REASON_RULES.map((rule) => rule(ctx)).filter((reason): reason is string => Boolean(reason)),
    spokenLanguages: toDiscoverLanguages(candidateRows, "SPEAKS"),
    learningLanguages: toDiscoverLanguages(candidateRows, "LEARNING"),
  };
}

export function compareByMatchScoreDesc(
  a: { matchScore: number; displayName: string; id: string },
  b: { matchScore: number; displayName: string; id: string },
) {
  if (b.matchScore !== a.matchScore) {
    return b.matchScore - a.matchScore;
  }
  const byName = a.displayName.localeCompare(b.displayName);
  if (byName !== 0) {
    return byName;
  }
  return a.id.localeCompare(b.id);
}
