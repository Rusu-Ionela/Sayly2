import type { LanguageType, ProficiencyLevel } from "../../db/schema";

import type { LanguageDto, UserLanguageItemDto, UserLanguagesGroupedDto } from "./types";

type LanguageRow = {
  id: string;
  code: string;
  name: string;
  flagEmoji: string;
  sortOrder: number;
};

type UserLanguageWithCatalog = {
  id: string;
  languageId: string;
  type: LanguageType;
  proficiencyLevel: ProficiencyLevel;
  language: {
    code: string;
    name: string;
    flagEmoji: string;
  };
};

export function toLanguageDto(row: LanguageRow): LanguageDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    flagEmoji: row.flagEmoji,
    sortOrder: row.sortOrder,
  };
}

export function toUserLanguageItemDto(row: UserLanguageWithCatalog): UserLanguageItemDto {
  return {
    id: row.id,
    languageId: row.languageId,
    code: row.language.code,
    name: row.language.name,
    flagEmoji: row.language.flagEmoji,
    type: row.type,
    proficiency: row.proficiencyLevel,
  };
}

export function groupUserLanguages(rows: UserLanguageWithCatalog[]): UserLanguagesGroupedDto {
  const items = rows.map(toUserLanguageItemDto);
  return {
    SPEAKS: items.filter((item) => item.type === "SPEAKS"),
    LEARNING: items.filter((item) => item.type === "LEARNING"),
  };
}
