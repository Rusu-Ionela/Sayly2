import type { IcebreakerPromptDto } from "@sayly/shared";

import { ICEBREAKER_PROMPTS, type IcebreakerPrompt, type PromptLanguage } from "./catalog";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The prompt day is the UTC calendar day, so every member sees the same question for a language. */
export function promptDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/** "pt-br" → "pt": regional variants share the base translation. */
function baseLanguage(languageId: string): string {
  return languageId.split("-")[0] ?? languageId;
}

function isPromptLanguage(code: string): code is PromptLanguage {
  return code === "es" || code === "fr" || code === "de" || code === "it" || code === "pt" || code === "ro";
}

/** Small stable hash, so each language starts the rotation at a different question. */
function languageOffset(code: string): number {
  let hash = 0;
  for (const char of code) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return hash;
}

/** Same question for everyone practising `languageId` on `day`; a different one each day. */
export function pickPrompt(languageId: string, day: string): IcebreakerPrompt {
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
  const index = (dayNumber + languageOffset(baseLanguage(languageId))) % ICEBREAKER_PROMPTS.length;
  const prompt = ICEBREAKER_PROMPTS[index];
  if (!prompt) throw new Error("Icebreaker catalog is empty");
  return prompt;
}

export function toPromptDto(prompt: IcebreakerPrompt, languageId: string, day: string): IcebreakerPromptDto {
  const base = baseLanguage(languageId);
  const translated = isPromptLanguage(base) ? prompt.translations[base] : undefined;
  return {
    id: prompt.id,
    date: day,
    languageId,
    text: translated ?? prompt.en,
    english: prompt.en,
    translated: Boolean(translated) || base === "en",
  };
}
