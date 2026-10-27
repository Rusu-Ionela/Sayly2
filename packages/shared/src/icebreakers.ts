import { z } from "zod";

import { multilineTextSchema } from "./validation";

export const ICEBREAKER_ANSWER_MAX = 500;
export const ICEBREAKER_ANSWERS_PAGE_SIZE = 20;

/** Language codes are short ISO-639 ids such as "es" or "pt-br". */
export const languageIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2,3}(-[a-z]{2,4})?$/, "Choose a language");

export const icebreakerLanguageQuerySchema = z.object({ languageId: languageIdSchema }).strict();

/** PUT /icebreakers/today/answer — one answer per member, language and day (resending edits it). */
export const icebreakerAnswerSchema = z
  .object({
    languageId: languageIdSchema,
    body: multilineTextSchema(ICEBREAKER_ANSWER_MAX, "Answer").pipe(
      z.string().min(1, "Write a short answer"),
    ),
  })
  .strict();

export type IcebreakerAnswerInput = z.infer<typeof icebreakerAnswerSchema>;

export type IcebreakerPromptDto = {
  /** Stable id of the question in the catalog. */
  id: string;
  /** UTC day the prompt belongs to ("YYYY-MM-DD"). */
  date: string;
  languageId: string;
  /** The question in `languageId` when a translation exists, otherwise in English. */
  text: string;
  /** The English original, for learners who want a hint. */
  english: string;
  translated: boolean;
};

export type IcebreakerAuthorDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  country: string;
};

export type IcebreakerAnswerDto = {
  id: string;
  body: string;
  createdAt: string;
  author: IcebreakerAuthorDto;
};

export type IcebreakerTodayDto = {
  prompt: IcebreakerPromptDto;
  myAnswer: { body: string; updatedAt: string } | null;
  /** Answers from other visible members. */
  answerCount: number;
};

export type IcebreakerAnswersPageDto = {
  items: IcebreakerAnswerDto[];
  nextCursor: string | null;
};
