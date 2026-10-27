import type { CurrentUserProfile } from "@/features/profile/types";
import {
  MAX_LEARNING_LANGUAGES,
  MAX_SPOKEN_LANGUAGES,
  MIN_LANGUAGES_PER_ROLE,
} from "@sayly/shared";
import type {
  ProficiencyLevel,
  UserLanguageDto,
  Language,
  LanguageType,
  SyncUserLanguagesPayload,
  UserLanguageItem,
  UserLanguagesGrouped,
} from "./types";

export function languageFlag(language: Pick<Language, "flagEmoji" | "code" | "name">): string {
  if (language.flagEmoji && language.flagEmoji.trim().length > 0) {
    return language.flagEmoji;
  }
  return "🏳️";
}

export function filterLanguageCatalog(catalog: Language[], query: string): Language[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return catalog;
  }

  return catalog.filter((language) => {
    const name = language.name.toLowerCase();
    const code = language.code.toLowerCase();
    const id = language.id.toLowerCase();
    return name.includes(needle) || code.includes(needle) || id.includes(needle);
  });
}

function selectedLanguageIds(grouped: UserLanguagesGrouped): Set<string> {
  return selectedLanguageIdsFromLists(
    grouped.SPEAKS.map((item) => ({ languageId: item.languageId, proficiency: item.proficiency })),
    grouped.LEARNING.map((item) => ({
      languageId: item.languageId,
      proficiency: item.proficiency,
    })),
  );
}

export function selectedLanguageIdsFromLists(
  spoken: { languageId: string }[],
  learning: { languageId: string }[],
): Set<string> {
  return new Set([
    ...spoken.map((item) => item.languageId),
    ...learning.map((item) => item.languageId),
  ]);
}

const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  pt: "Português",
  it: "Italiano",
  ru: "Русский",
  ar: "العربية",
  hi: "हिन्दी",
  tr: "Türkçe",
  nl: "Nederlands",
  pl: "Polski",
  uk: "Українська",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  th: "ไทย",
  sv: "Svenska",
  ro: "Română",
  el: "Ελληνικά",
  cs: "Čeština",
  hu: "Magyar",
  he: "עברית",
  fi: "Suomi",
  da: "Dansk",
  no: "Norsk",
  ms: "Bahasa Melayu",
  tl: "Filipino",
  fa: "فارسی",
  bn: "বাংলা",
  ur: "اردو",
};

export function languageNativeName(language: Pick<Language, "code" | "name">): string {
  return NATIVE_LANGUAGE_NAMES[language.code.toLowerCase()] ?? language.name;
}

export function toSyncPayload(grouped: UserLanguagesGrouped): SyncUserLanguagesPayload {
  return {
    spokenLanguages: grouped.SPEAKS.map((item) => ({
      languageId: item.languageId,
      proficiency: item.proficiency,
    })),
    learningLanguages: grouped.LEARNING.map((item) => ({
      languageId: item.languageId,
      proficiency: item.proficiency,
    })),
  };
}

function toUserLanguageDto(item: UserLanguageItem): UserLanguageDto {
  return {
    languageId: item.languageId,
    code: item.code,
    name: item.name,
    flagEmoji: item.flagEmoji,
    proficiency: item.proficiency,
  };
}

export function patchProfileLanguages(
  profile: CurrentUserProfile,
  grouped: UserLanguagesGrouped,
): CurrentUserProfile {
  return {
    ...profile,
    spokenLanguages: grouped.SPEAKS.map(toUserLanguageDto),
    learningLanguages: grouped.LEARNING.map(toUserLanguageDto),
    nativeLanguages: grouped.SPEAKS.filter((item) => item.proficiency === "NATIVE").map(
      (item) => item.name,
    ),
  };
}

export function findCatalogLanguage(catalog: Language[], languageId: string): Language | undefined {
  return catalog.find((item) => item.id === languageId || item.code === languageId);
}

export function canAddLanguage(grouped: UserLanguagesGrouped, type: LanguageType): string | null {
  if (type === "LEARNING" && grouped.LEARNING.length >= MAX_LEARNING_LANGUAGES) {
    return `You can learn up to ${MAX_LEARNING_LANGUAGES} languages at a time.`;
  }
  if (type === "SPEAKS" && grouped.SPEAKS.length >= MAX_SPOKEN_LANGUAGES) {
    return `You can add up to ${MAX_SPOKEN_LANGUAGES} spoken languages.`;
  }
  return null;
}

/** Same language cannot appear in spoken and learning (or twice in one list). */
export function duplicateLanguageMessage(
  grouped: UserLanguagesGrouped,
  languageId: string,
): string | null {
  if (selectedLanguageIds(grouped).has(languageId)) {
    return "That language is already in your languages.";
  }
  return null;
}

export function canRemoveLanguage(
  grouped: UserLanguagesGrouped,
  type: LanguageType,
): string | null {
  const count = grouped[type].length;
  if (count <= MIN_LANGUAGES_PER_ROLE) {
    return type === "SPEAKS"
      ? "Keep at least one spoken language so partners know how to talk with you."
      : "Keep at least one learning language so we can find practice partners.";
  }
  return null;
}

export function applyAddLanguage(
  grouped: UserLanguagesGrouped,
  type: LanguageType,
  language: Language,
  proficiency: ProficiencyLevel,
): UserLanguagesGrouped {
  const nextItem: UserLanguageItem = {
    id: `optimistic-${type}-${language.id}`,
    languageId: language.id,
    code: language.code,
    name: language.name,
    flagEmoji: languageFlag(language),
    type,
    proficiency,
  };

  return {
    ...grouped,
    [type]: [...grouped[type], nextItem],
  };
}

export function applyRemoveLanguage(
  grouped: UserLanguagesGrouped,
  type: LanguageType,
  languageId: string,
): UserLanguagesGrouped {
  return {
    ...grouped,
    [type]: grouped[type].filter((item) => item.languageId !== languageId),
  };
}

export function applyProficiency(
  grouped: UserLanguagesGrouped,
  type: LanguageType,
  languageId: string,
  proficiency: ProficiencyLevel,
): UserLanguagesGrouped {
  return {
    ...grouped,
    [type]: grouped[type].map((item) =>
      item.languageId === languageId ? { ...item, proficiency } : item,
    ),
  };
}
