import type {
  IcebreakerAnswerInput,
  IcebreakerAnswersPageDto,
  IcebreakerTodayDto,
} from "@sayly/shared";

import { apiClient } from "@/lib/apiClient";

const query = (languageId: string, cursor?: string) => {
  const params = new URLSearchParams({ languageId });
  if (cursor) params.set("cursor", cursor);
  return params.toString();
};

export function getTodayIcebreaker(languageId: string) {
  return apiClient.get<IcebreakerTodayDto>(`/icebreakers/today?${query(languageId)}`);
}

export function getIcebreakerAnswers(languageId: string, cursor?: string) {
  return apiClient.get<IcebreakerAnswersPageDto>(
    `/icebreakers/today/answers?${query(languageId, cursor)}`,
  );
}

export function saveIcebreakerAnswer(input: IcebreakerAnswerInput) {
  return apiClient.put<{ body: string; updatedAt: string }>("/icebreakers/today/answer", input);
}

export function deleteIcebreakerAnswer(languageId: string) {
  return apiClient.delete<{ deleted: boolean }>(`/icebreakers/today/answer?${query(languageId)}`);
}
