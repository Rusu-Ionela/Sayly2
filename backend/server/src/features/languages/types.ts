import type { LanguageType, ProficiencyLevel } from "../../db/schema";

export type LanguageDto = {
  id: string;
  code: string;
  name: string;
  flagEmoji: string;
  sortOrder: number;
};

export type UserLanguageItemDto = {
  id: string;
  languageId: string;
  code: string;
  name: string;
  flagEmoji: string;
  type: LanguageType;
  proficiency: ProficiencyLevel;
};

/** LANG-002P0 grouped response for GET/PUT /users/me/languages. */
export type UserLanguagesGroupedDto = {
  SPEAKS: UserLanguageItemDto[];
  LEARNING: UserLanguageItemDto[];
};

export type LanguageSelectionInput = {
  languageId: string;
  proficiency: ProficiencyLevel;
};

export type SyncUserLanguagesInput = {
  spokenLanguages: LanguageSelectionInput[];
  learningLanguages: LanguageSelectionInput[];
};

export type { LanguageType, ProficiencyLevel };
