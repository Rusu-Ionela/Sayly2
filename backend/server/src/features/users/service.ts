import { AppError } from "../../shared/errors/AppError";
import * as languagesService from "../languages/service";
import { translateProfileText } from "../messaging/learning";
import { broadcastPresence } from "../messaging/presenceBroadcast";
import { logger } from "../../shared/utils/logger";
import type { SyncUserLanguagesInput } from "../languages/types";

import { toCurrentUserDto } from "./dto";
import { buildDataExport } from "./export";
import { geocodePlace } from "./geocode";
import * as usersRepository from "./repository";
import * as settingsRepository from "./settings";
import type {
  CompleteOnboardingInput,
  CurrentUserDto,
  OnboardingDraftInput,
  UpdateProfileInput,
  UpdateSettingsInput,
} from "./types";

function languageIdsFromPair(input: SyncUserLanguagesInput): string[] {
  return [
    ...input.spokenLanguages.map((item) => item.languageId),
    ...input.learningLanguages.map((item) => item.languageId),
  ];
}

/** Single read + mapping used by every /users/me* endpoint that returns the profile. */
async function getCurrentUser(userId: string): Promise<CurrentUserDto> {
  return toCurrentUserDto(await usersRepository.getCurrentUserSource(userId));
}

export function getMe(userId: string) {
  return getCurrentUser(userId);
}

export function getOnboardingDraft(userId: string) {
  return usersRepository.getOnboardingDraft(userId);
}

export function saveOnboardingDraft(userId: string, input: OnboardingDraftInput) {
  return usersRepository.saveOnboardingDraft(userId, input);
}

/**
 * Re-geocodes the saved city/country. The previous position is cleared when the lookup
 * fails, so a stale map can never outlive a changed location.
 */
async function refreshLocation(userId: string) {
  const { profile } = await usersRepository.getCurrentUserSource(userId);
  if (!profile?.country) {
    return;
  }
  await usersRepository.setProfileCoordinates(userId, await geocodePlace(profile.city, profile.country));
}

export async function completeOnboarding(userId: string, input: CompleteOnboardingInput) {
  await languagesService.assertLanguagesExist(languageIdsFromPair(input));
  await usersRepository.completeOnboarding(userId, input);
  if (input.country !== undefined) {
    await refreshLocation(userId);
  }
  return getCurrentUser(userId);
}

/** PRO-002 — PUT /users/me/profile and PATCH /users/me: one atomic edit. */
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (input.languages) {
    await languagesService.assertLanguagesExist(languageIdsFromPair(input.languages));
  }
  await usersRepository.updateProfile(userId, input);
  if (input.city !== undefined || input.country !== undefined) {
    await refreshLocation(userId);
  }
  return getCurrentUser(userId);
}

/** PATCH /users/me/settings — returns the full profile so clients refresh one cache entry. */
export async function updateSettings(userId: string, input: UpdateSettingsInput) {
  await settingsRepository.updateSettings(userId, input);
  if (input.showOnlineStatus !== undefined) {
    // Partners must see the change now, not on the next connect/disconnect.
    void broadcastPresence(userId).catch((error: unknown) => {
      logger.warn("presence", "settings presence broadcast failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    });
  }
  return getCurrentUser(userId);
}

/** GET /users/me/export — "Download my data". */
export async function exportMyData(userId: string) {
  return buildDataExport(userId, await getCurrentUser(userId));
}

/** GET /users/by-sayly-id/:saylyId — open a profile from a shared code. */
export function findBySaylyId(viewerId: string, saylyId: string) {
  return usersRepository.findUserIdBySaylyId(viewerId, saylyId);
}

export async function getUserById(viewerId: string, targetUserId: string) {
  return usersRepository.getPublicProfile(viewerId, targetUserId);
}

/** Translates one public profile field for the viewer. Reuses the profile's visibility rules. */
export async function translateProfileField(
  viewerId: string,
  targetUserId: string,
  field: "bio" | "topics",
) {
  const profile = await usersRepository.getSafePublicProfile(viewerId, targetUserId);
  const text = (field === "bio" ? profile.bio : profile.topics.join(", ")).trim();
  if (!text) {
    throw new AppError("Nothing to translate", 400, "VALIDATION_ERROR");
  }
  return translateProfileText(viewerId, targetUserId, text);
}

/** PRO-001 — safe public profile. */
export async function getPublicProfile(viewerId: string, targetUserId: string) {
  return usersRepository.getSafePublicProfile(viewerId, targetUserId);
}

/** LANG-002P0 GET /users/me/languages */
export function getMyLanguages(userId: string) {
  return languagesService.getMyLanguages(userId);
}

/** LANG-002P0 PUT /users/me/languages — atomic bulk sync, grouped response. */
export async function putMyLanguages(userId: string, input: SyncUserLanguagesInput) {
  await languagesService.assertLanguagesExist(languageIdsFromPair(input));
  await usersRepository.updateUserLanguages(userId, input);
  return languagesService.getMyLanguages(userId);
}

/** PATCH /users/me/languages — same sync, returns the current-user DTO for existing clients. */
export function updateLanguages(userId: string, input: SyncUserLanguagesInput) {
  return updateProfile(userId, { languages: input });
}

export function softDeleteAccount(userId: string) {
  return usersRepository.softDeleteAccount(userId);
}

export function changePassword(userId: string, currentPassword: string, newPassword: string) {
  return usersRepository.changePassword(userId, currentPassword, newPassword);
}
