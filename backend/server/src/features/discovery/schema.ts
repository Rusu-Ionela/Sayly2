import { z } from "zod";

import { proficiencySchema } from "../languages/schema";
import { PRACTICE_GOALS } from "../users/practiceGoals";

/** DISC-003 proficiency filter — catalog levels stored on UserLanguage. */
export const DISCOVERY_PROFICIENCY_VALUES = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "FLUENT",
  "NATIVE",
] as const;

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const optionalQueryString = (max: number) =>
  z.preprocess(blankToUndefined, z.string().min(1).max(max).optional());

/**
 * Language catalog ids are ISO-639-1 codes (e.g. "en"), not UUIDs.
 * Accept any non-empty id the catalog / UserLanguage.languageId uses.
 */
const optionalLanguageId = z.preprocess(
  blankToUndefined,
  z
    .string()
    .min(1)
    .max(64)
    .optional(),
);

const optionalProficiency = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, proficiencySchema.optional());

/**
 * GET /discover query string.
 * DISC-004: `page` defaults to 1, `limit` defaults to 20 (max 50).
 * `spokenLanguage` / `learningLanguage` are accepted as aliases of the *Id fields
 * so existing mobile clients keep working.
 */
export const discoverQuerySchema = z
  .object({
    search: optionalQueryString(80),
    spokenLanguageId: optionalLanguageId,
    learningLanguageId: optionalLanguageId,
    spokenLanguage: optionalLanguageId,
    learningLanguage: optionalLanguageId,
    country: optionalQueryString(80),
    proficiency: optionalProficiency,
    practiceGoal: z.preprocess(blankToUndefined, z.enum(PRACTICE_GOALS).optional()),
    matchType: z.preprocess(blankToUndefined, z.enum(["MUTUAL"]).optional()),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .transform((value) => ({
    search: value.search,
    spokenLanguageId: value.spokenLanguageId ?? value.spokenLanguage,
    learningLanguageId: value.learningLanguageId ?? value.learningLanguage,
    country: value.country,
    proficiency: value.proficiency,
    practiceGoal: value.practiceGoal,
    matchType: value.matchType,
    page: value.page,
    limit: value.limit,
  }));

export type DiscoverQuery = z.output<typeof discoverQuerySchema>;
