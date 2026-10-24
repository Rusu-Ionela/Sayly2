export type ProficiencyLevel =
  | "NATIVE"
  | "FLUENT"
  | "ADVANCED"
  | "UPPER_INTERMEDIATE"
  | "INTERMEDIATE"
  | "ELEMENTARY"
  | "BEGINNER";

export type UserLanguageSelection = {
  languageId: string;
  proficiency: ProficiencyLevel;
};

export type UserLanguageDto = UserLanguageSelection & {
  code: string;
  name: string;
  flagEmoji?: string;
};

export type LanguageType = "SPEAKS" | "LEARNING";

export type LanguageSetupSection = "native" | "fluent" | "learning";

export type Language = {
  id: string;
  code: string;
  name: string;
  flagEmoji?: string;
  sortOrder?: number;
};

export type UserLanguageItem = {
  id: string;
  languageId: string;
  code: string;
  name: string;
  flagEmoji: string;
  type: LanguageType;
  proficiency: ProficiencyLevel;
};

export type UserLanguagesGrouped = {
  SPEAKS: UserLanguageItem[];
  LEARNING: UserLanguageItem[];
};

export type SyncUserLanguagesPayload = {
  spokenLanguages: UserLanguageSelection[];
  learningLanguages: UserLanguageSelection[];
};
