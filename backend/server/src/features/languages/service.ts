import { AppError } from "../../shared/errors/AppError";

import { groupUserLanguages } from "./dto";
import * as languagesRepository from "./repository";
import type { UserLanguagesGroupedDto } from "./types";

export function listLanguages() {
  return languagesRepository.listLanguages();
}

export async function assertLanguagesExist(languageIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(languageIds)];
  if (uniqueIds.length === 0) {
    return;
  }

  const found = await languagesRepository.findLanguagesByIds(uniqueIds);
  if (found.length === uniqueIds.length) {
    return;
  }

  const foundIds = new Set(found.map((item) => item.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));
  throw new AppError(
    `Language not found: ${missing[0] ?? "unknown"}`,
    404,
    "NOT_FOUND",
  );
}

export async function getMyLanguages(userId: string): Promise<UserLanguagesGroupedDto> {
  const rows = await languagesRepository.findUserLanguages(userId);
  return groupUserLanguages(rows);
}
