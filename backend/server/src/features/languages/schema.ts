import { z } from "zod";

import type { ProficiencyLevel } from "../../db/schema";

export const MAX_SPOKEN_LANGUAGES = 10;
export const MAX_LEARNING_LANGUAGES = 5;
export const MAX_NATIVE_LANGUAGES = 1;

export const PROFICIENCY_VALUES = [
  "BEGINNER",
  "ELEMENTARY",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "ADVANCED",
  "FLUENT",
  "NATIVE",
] as const;

export const LANGUAGE_TYPE_VALUES = ["SPEAKS", "LEARNING"] as const;

export const proficiencySchema = z
  .string()
  .min(1)
  .transform((value) => value.trim().toUpperCase().replace(/[\s-]+/g, "_"))
  .pipe(z.enum(PROFICIENCY_VALUES));

export const languageTypeSchema = z.enum(LANGUAGE_TYPE_VALUES);

export const languageSelectionSchema = z.object({
  languageId: z.string().trim().min(1).max(16),
  proficiency: proficiencySchema,
});

export function mapLanguageSelections(
  items: Array<{ languageId: string; proficiency: (typeof PROFICIENCY_VALUES)[number] }>,
): Array<{ languageId: string; proficiency: ProficiencyLevel }> {
  return items.map((item) => ({
    languageId: item.languageId,
    proficiency: item.proficiency,
  }));
}

function uniqueIds(items: Array<{ languageId: string }>): boolean {
  return new Set(items.map((item) => item.languageId)).size === items.length;
}

export function addLanguageSelectionIssues(
  spokenLanguages: Array<{ languageId: string; proficiency: string }>,
  learningLanguages: Array<{ languageId: string; proficiency: string }>,
  ctx: z.RefinementCtx,
): void {
  if (!uniqueIds(spokenLanguages)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "spokenLanguages must not contain duplicate languageId values",
      path: ["spokenLanguages"],
    });
  }

  if (!uniqueIds(learningLanguages)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "learningLanguages must not contain duplicate languageId values",
      path: ["learningLanguages"],
    });
  }

  const spokenById = new Map(
    spokenLanguages.map((item) => [item.languageId, item.proficiency]),
  );

  for (const item of learningLanguages) {
    const spokenProficiency = spokenById.get(item.languageId);
    if (spokenProficiency === undefined) {
      continue;
    }

    if (spokenProficiency === item.proficiency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A language cannot be both SPEAKS and LEARNING at the same proficiency",
        path: ["learningLanguages"],
      });
      continue;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A language cannot be both spoken and learning",
      path: ["learningLanguages"],
    });
  }

  const nativeCount = spokenLanguages.filter((item) => item.proficiency === "NATIVE").length;
  if (nativeCount > MAX_NATIVE_LANGUAGES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `At most ${MAX_NATIVE_LANGUAGES} native language allowed`,
      path: ["spokenLanguages"],
    });
  }
}

const languagePairObjectSchema = z.object({
  spokenLanguages: z
    .array(languageSelectionSchema)
    .min(1, "Select at least one spoken language")
    .max(MAX_SPOKEN_LANGUAGES, `At most ${MAX_SPOKEN_LANGUAGES} spoken languages`),
  learningLanguages: z
    .array(languageSelectionSchema)
    .min(1, "Select at least one learning language")
    .max(MAX_LEARNING_LANGUAGES, `At most ${MAX_LEARNING_LANGUAGES} learning languages`),
});

/** PUT/PATCH /users/me/languages — full replace of the authenticated user's languages. */
export const syncUserLanguagesSchema = languagePairObjectSchema
  .strict()
  .superRefine((value, ctx) => {
    addLanguageSelectionIssues(value.spokenLanguages, value.learningLanguages, ctx);
  })
  .transform((value) => ({
    spokenLanguages: mapLanguageSelections(value.spokenLanguages),
    learningLanguages: mapLanguageSelections(value.learningLanguages),
  }));

export const spokenLanguagesFieldSchema = z
  .array(languageSelectionSchema)
  .min(1)
  .max(MAX_SPOKEN_LANGUAGES);

export const learningLanguagesFieldSchema = z
  .array(languageSelectionSchema)
  .min(1)
  .max(MAX_LEARNING_LANGUAGES);
