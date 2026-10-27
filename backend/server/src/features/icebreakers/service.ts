import type {
  IcebreakerAnswerInput,
  IcebreakerAnswersPageDto,
  IcebreakerTodayDto,
} from "@sayly/shared";

import { AppError } from "../../shared/errors/AppError";
import { normalizeLanguageCode } from "../languages/catalog";
import { recordActivityInBackground } from "../streaks";
import { loadMemberSummaries } from "../users/memberSummary";

import { pickPrompt, promptDay, toPromptDto } from "./prompt";
import * as repository from "./repository";

/** Catalog language id, or a 400 for anything Sayly does not offer. */
function requireLanguage(raw: string): string {
  const languageId = normalizeLanguageCode(raw);
  if (!languageId) {
    throw new AppError("Unknown language", 400, "VALIDATION_ERROR");
  }
  return languageId;
}

function today(languageId: string, at?: Date) {
  const promptDate = promptDay(at);
  return { languageId, promptDate, prompt: pickPrompt(languageId, promptDate) };
}

export async function getToday(viewerId: string, rawLanguageId: string): Promise<IcebreakerTodayDto> {
  const { languageId, promptDate, prompt } = today(requireLanguage(rawLanguageId));
  const day = { languageId, promptDate };
  const [mine, answerCount] = await Promise.all([
    repository.findOwnAnswer(viewerId, day),
    repository.countVisibleAnswers(viewerId, day),
  ]);
  return {
    prompt: toPromptDto(prompt, languageId, promptDate),
    myAnswer: mine ? { body: mine.body, updatedAt: mine.updatedAt.toISOString() } : null,
    answerCount,
  };
}

export async function listAnswers(
  viewerId: string,
  rawLanguageId: string,
  cursor?: string,
): Promise<IcebreakerAnswersPageDto> {
  const { languageId, promptDate } = today(requireLanguage(rawLanguageId));
  const { rows, hasMore } = await repository.listVisibleAnswers(viewerId, { languageId, promptDate }, cursor);
  const authors = await loadMemberSummaries(rows.map((row) => row.userId));

  const items = rows.flatMap((row) => {
    const author = authors.get(row.userId);
    if (!author) return [];
    return [
      {
        id: row.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        author: {
          id: author.id,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          country: author.country,
        },
      },
    ];
  });
  const last = rows.at(-1);
  return { items, nextCursor: hasMore && last ? last.id : null };
}

/** Answering also counts the day for the member's streak. */
export async function saveAnswer(userId: string, input: IcebreakerAnswerInput) {
  const { languageId, promptDate, prompt } = today(requireLanguage(input.languageId));
  const saved = await repository.saveAnswer(userId, {
    languageId,
    promptDate,
    promptId: prompt.id,
    body: input.body,
  });
  recordActivityInBackground(userId);
  return { body: saved.body, updatedAt: saved.updatedAt.toISOString() };
}

export async function deleteAnswer(userId: string, rawLanguageId: string) {
  const { languageId, promptDate } = today(requireLanguage(rawLanguageId));
  return { deleted: await repository.deleteAnswer(userId, { languageId, promptDate }) };
}
