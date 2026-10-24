import type { Language, UserLanguageDto, UserLanguageSelection } from "@/features/languages/types";
import { findCatalogLanguage } from "@/features/languages/utils";

import type {
  Certificate,
  CertificateInput,
  CurrentUserProfile,
  UpdateProfilePayload,
  UpdateSettingsPayload,
} from "../types";

/** Selections → display DTOs, reusing names/flags already known before falling back to the catalog. */
export function toLanguageDtos(
  selections: UserLanguageSelection[],
  previous: UserLanguageDto[],
  catalog: Language[],
): UserLanguageDto[] {
  const previousById = new Map(previous.map((item) => [item.languageId, item]));

  return selections.map((selection) => {
    const known = previousById.get(selection.languageId);
    const language = findCatalogLanguage(catalog, selection.languageId);
    return {
      languageId: selection.languageId,
      proficiency: selection.proficiency,
      code: known?.code ?? language?.code ?? selection.languageId,
      name: known?.name ?? language?.name ?? selection.languageId,
      flagEmoji: known?.flagEmoji ?? language?.flagEmoji,
    };
  });
}

/** Certificate inputs → display rows; ids are placeholders until the server responds. */
function toCertificates(inputs: CertificateInput[], catalog: Language[]): Certificate[] {
  return inputs.map((input, index) => {
    const language = findCatalogLanguage(catalog, input.languageId);
    return {
      id: `pending-${index}`,
      languageId: input.languageId,
      languageName: language?.name ?? input.languageId,
      flagEmoji: language?.flagEmoji ?? "",
      level: input.level,
      title: input.title,
      issuedYear: input.issuedYear ?? null,
    };
  });
}

/**
 * Optimistic projection of an edit-profile payload onto the cached profile, so the UI
 * updates before the server answers. The server response replaces it on success and the
 * previous snapshot is restored on error; derived flags (e.g. `profileCompleted`) are
 * left for the server to recompute.
 */
export function applyProfilePatch(
  profile: CurrentUserProfile,
  payload: UpdateProfilePayload,
  catalog: Language[] = [],
): CurrentUserProfile {
  const next: CurrentUserProfile = { ...profile };

  if (payload.displayName !== undefined) next.displayName = payload.displayName;
  if (payload.bio !== undefined) next.bio = payload.bio;
  if (payload.country !== undefined) next.country = payload.country;
  if (payload.city !== undefined) next.city = payload.city || null;
  if (payload.dateOfBirth !== undefined) next.dateOfBirth = payload.dateOfBirth;
  if (payload.practiceGoals !== undefined) next.practiceGoals = payload.practiceGoals;
  if (payload.topics !== undefined) next.topics = payload.topics;
  if (payload.photos !== undefined) next.photos = payload.photos;
  if (payload.learningPreferences !== undefined) {
    next.learningPreferences = { ...profile.learningPreferences, ...payload.learningPreferences };
  }
  if (payload.certificates !== undefined) {
    next.certificates = toCertificates(payload.certificates, catalog);
  }

  if (payload.avatarUrl !== undefined) {
    const avatar = payload.avatarUrl ?? undefined;
    next.avatarUrl = avatar;
    next.profileImageUrl = avatar;
    next.photoUrl = avatar;
  }

  if (payload.spokenLanguages && payload.learningLanguages) {
    next.spokenLanguages = toLanguageDtos(
      payload.spokenLanguages,
      profile.spokenLanguages,
      catalog,
    );
    next.learningLanguages = toLanguageDtos(
      payload.learningLanguages,
      profile.learningLanguages,
      catalog,
    );
    next.nativeLanguages = next.spokenLanguages
      .filter((item) => item.proficiency === "NATIVE")
      .map((item) => item.name);
  }

  return next;
}

/** Optimistic projection of a settings patch (toggles flip instantly). */
export function applySettingsPatch(
  profile: CurrentUserProfile,
  payload: UpdateSettingsPayload,
): CurrentUserProfile {
  return { ...profile, settings: { ...profile.settings, ...payload } };
}
