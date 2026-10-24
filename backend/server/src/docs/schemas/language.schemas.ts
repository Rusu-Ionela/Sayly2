import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

import { PROFICIENCY_VALUES } from "../../features/languages/schema";

extendZodWithOpenApi(z);

const proficiencySchema = z.enum(PROFICIENCY_VALUES);

export const LanguageSchema = z
  .object({
    id: z.string().openapi({ example: "en" }),
    code: z.string().openapi({ example: "en", description: "ISO-639-1" }),
    name: z.string().openapi({ example: "English" }),
    flagEmoji: z.string().openapi({ example: "🇬🇧" }),
    sortOrder: z.number().int().openapi({ example: 1, description: "1 = most popular" }),
  })
  .openapi("Language");

export const UserLanguageItemSchema = z
  .object({
    id: z.string(),
    languageId: z.string().openapi({ example: "en" }),
    code: z.string().openapi({ example: "en" }),
    name: z.string().openapi({ example: "English" }),
    flagEmoji: z.string().openapi({ example: "🇬🇧" }),
    type: z.enum(["SPEAKS", "LEARNING"]),
    proficiency: proficiencySchema,
  })
  .openapi("UserLanguageItem");

export const UserLanguagesGroupedSchema = z
  .object({
    SPEAKS: z.array(UserLanguageItemSchema),
    LEARNING: z.array(UserLanguageItemSchema),
  })
  .openapi("UserLanguagesGrouped");

const languageSelectionSchema = z.object({
  languageId: z.string().min(1).openapi({ example: "en" }),
  proficiency: proficiencySchema,
});

export const SyncUserLanguagesRequestSchema = z
  .object({
    spokenLanguages: z.array(languageSelectionSchema).min(1).max(10),
    learningLanguages: z.array(languageSelectionSchema).min(1).max(5),
  })
  .openapi("SyncUserLanguagesRequest");
