import { z } from "zod";

/** ISO-639 code such as "es" or "pt-br"; the API maps regional variants to its catalog. */
const languageCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2,3}(-[a-z]{2,4})?$/, "Unknown language");

/**
 * POST /conversations/:id/messages/:messageId/translate
 * `targetLang` defaults to the member's "Translate to" setting (else their native language);
 * `sourceLang` defaults to automatic detection.
 */
export const translateMessageSchema = z
  .object({
    targetLang: languageCodeSchema.optional(),
    sourceLang: languageCodeSchema.optional(),
  })
  .strict();

export type TranslateMessageInput = z.infer<typeof translateMessageSchema>;

/** PUT /conversations/:id/auto-translate — this member's choice for this chat only. */
export const autoTranslateSchema = z.object({ enabled: z.boolean() }).strict();

export type AutoTranslateInput = z.infer<typeof autoTranslateSchema>;
