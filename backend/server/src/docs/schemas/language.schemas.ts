import { z } from "zod";
import { PROFICIENCY_LEVELS } from "@sayly/shared";


const proficiencySchema = z.enum(PROFICIENCY_LEVELS);

export const LanguageSchema = z
  .object({
    id: z.string().meta({ example: "en" }),
    code: z.string().meta({ example: "en", description: "ISO-639-1" }),
    name: z.string().meta({ example: "English" }),
    flagEmoji: z.string().meta({ example: "🇬🇧" }),
    sortOrder: z.number().int().meta({ example: 1, description: "1 = most popular" }),
  })
  .meta({ id: "Language" });

export const UserLanguageItemSchema = z
  .object({
    id: z.string(),
    languageId: z.string().meta({ example: "en" }),
    code: z.string().meta({ example: "en" }),
    name: z.string().meta({ example: "English" }),
    flagEmoji: z.string().meta({ example: "🇬🇧" }),
    type: z.enum(["SPEAKS", "LEARNING"]),
    proficiency: proficiencySchema,
  })
  .meta({ id: "UserLanguageItem" });

export const UserLanguagesGroupedSchema = z
  .object({
    SPEAKS: z.array(UserLanguageItemSchema),
    LEARNING: z.array(UserLanguageItemSchema),
  })
  .meta({ id: "UserLanguagesGrouped" });

const languageSelectionSchema = z.object({
  languageId: z.string().min(1).meta({ example: "en" }),
  proficiency: proficiencySchema,
});

export const SyncUserLanguagesRequestSchema = z
  .object({
    spokenLanguages: z.array(languageSelectionSchema).min(1).max(10),
    learningLanguages: z.array(languageSelectionSchema).min(1).max(5),
  })
  .meta({ id: "SyncUserLanguagesRequest" });
