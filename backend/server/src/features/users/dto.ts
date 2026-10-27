import type { ReferenceSummaryDto } from "@sayly/shared";
import type { CefrLevel, UserLanguageType, UserSettings } from "../../db/schema";

import { resignMediaUrl } from "../media/storage";

import { currentAge } from "./age";
import { toLearningPreferencesDto } from "./learningPreferences";
import { toUserSettingsDto, visibleLocation } from "./settings";
import type {
  CertificateDto,
  CurrentUserDto,
  OnlineStatus,
  ProfileStatsDto,
  PublicUserProfile,
  SafePublicProfile,
  UserLanguageDto,
} from "./types";

/** Fields that must never appear on public / discovery / connection partner payloads. */
export const FORBIDDEN_PUBLIC_PROFILE_KEYS = [
  "email",
  "password",
  "passwordHash",
  "authProvider",
  "emailVerifiedAt",
  "role",
  "status",
  "refreshToken",
  "refreshTokens",
  "accessToken",
  "tokenHash",
  "dateOfBirth",
  "gender",
  "onboardingCompleted",
  "profileCompleted",
  "settings",
  "stats",
  "saylyId",
] as const;

type LanguageWithCatalog = {
  languageId: string;
  type: UserLanguageType;
  proficiencyLevel: UserLanguageDto["proficiency"];
  language: { code: string; name: string; flagEmoji: string };
};

type ProfileSlice = {
  displayName: string;
  bio: string | null;
  country: string;
  city: string | null;
  profileImageUrl: string | null;
  practiceGoals: string[];
  topics: string[];
  photos: string[];
  profileCompleted: boolean;
  discoverable?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  dateOfBirth: Date | null;
  age: number | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  profileAnswers?: string[];
  communicationMethods?: string[];
  timeCommitment?: string | null;
  learningSchedule?: string[];
  correctionPreference?: string | null;
};

type CertificateWithCatalog = {
  id: string;
  languageId: string;
  level: CefrLevel;
  title: string;
  issuedYear: number | null;
  language: { name: string; flagEmoji: string };
};

/** Minimal user+profile shape used by public serializers (no email/hash required). */
export type PublicProfileSource = {
  id: string;
  isPro: boolean;
  onboardingCompleted: boolean;
  profile: ProfileSlice | null;
  languages: LanguageWithCatalog[];
  certificates: CertificateWithCatalog[];
  /** The main conversation topic (0 or 1 row). */
  conversationTopics: Array<{ title: string }>;
  /** null when the user never changed a setting (defaults apply). */
  settings: Omit<UserSettings, "userId" | "updatedAt"> | null;
  referenceSummary: ReferenceSummaryDto;
};

export type CurrentUserSource = PublicProfileSource & {
  email: string;
  saylyId: string;
  stats: ProfileStatsDto;
};

function mapLanguages(source: PublicProfileSource, type: UserLanguageType): UserLanguageDto[] {
  return source.languages
    .filter((item) => item.type === type)
    .map((item) => ({
      languageId: item.languageId,
      code: item.language.code,
      name: item.language.name,
      flagEmoji: item.language.flagEmoji,
      proficiency: item.proficiencyLevel,
    }));
}

function mapCertificates(source: PublicProfileSource): CertificateDto[] {
  return source.certificates.map((item) => ({
    id: item.id,
    languageId: item.languageId,
    languageName: item.language.name,
    flagEmoji: item.language.flagEmoji,
    level: item.level,
    title: item.title,
    issuedYear: item.issuedYear,
  }));
}

/** Map position, if the geocoder found one. */
function coordinates(profile: ProfileSlice | null) {
  return profile?.latitude != null && profile.longitude != null
    ? { latitude: profile.latitude, longitude: profile.longitude }
    : null;
}

/**
 * Profile-page fields shared by the self and public payloads. `audience: "public"`
 * applies the owner's visibility settings (hidden certificates are left out).
 */
function toShowcase(source: PublicProfileSource, city: string | null, audience: "self" | "public") {
  const profile = source.profile;
  const hideCertificates = audience === "public" && source.settings?.showCertificates === false;
  return {
    isPro: source.isPro,
    city,
    topics: profile?.topics ?? [],
    photos: (profile?.photos ?? []).map((path) => resignMediaUrl(path) ?? path),
    certificates: hideCertificates ? [] : mapCertificates(source),
    mainTopic: source.conversationTopics[0]?.title ?? null,
    references: source.referenceSummary,
    learningPreferences: toLearningPreferencesDto(profile),
  };
}

function resolveAvatarUrl(profile: ProfileSlice | null): string | undefined {
  const raw = profile?.profileImageUrl ?? undefined;
  if (!raw) {
    return undefined;
  }
  return resignMediaUrl(raw) ?? raw;
}

export function computeProfileCompleted(input: {
  displayName?: string | null;
  country?: string | null;
  age?: number | null;
  spokenCount: number;
  learningCount: number;
}) {
  return Boolean(
    input.displayName?.trim() &&
    input.country?.trim() &&
    input.age != null &&
    input.age >= 18 &&
    input.spokenCount > 0 &&
    input.learningCount > 0,
  );
}

function isProfileComplete(profile: ProfileSlice, spokenCount: number, learningCount: number) {
  return computeProfileCompleted({
    displayName: profile.displayName,
    country: profile.country,
    age: currentAge(profile),
    spokenCount,
    learningCount,
  });
}

/** Private / self profile — may include email and DOB. Never send on public routes. */
export function toCurrentUserDto(user: CurrentUserSource): CurrentUserDto {
  const spokenLanguages = mapLanguages(user, "SPEAKS");
  const learningLanguages = mapLanguages(user, "LEARNING");
  const profile = user.profile;
  const avatarUrl = resolveAvatarUrl(profile);

  return {
    ...toShowcase(user, profile?.city ?? null, "self"),
    id: user.id,
    saylyId: user.saylyId,
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
    profileCompleted: profile
      ? isProfileComplete(profile, spokenLanguages.length, learningLanguages.length)
      : false,
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    country: profile?.country ?? "",
    photoUrl: avatarUrl,
    profileImageUrl: avatarUrl,
    avatarUrl,
    dateOfBirth: profile?.dateOfBirth?.toISOString() ?? null,
    age: profile ? currentAge(profile) : null,
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    gender: profile?.gender === "MALE" || profile?.gender === "FEMALE" ? profile.gender : null,
    profileAnswers: profile?.profileAnswers ?? [],
    location: coordinates(profile),
    practiceGoals: profile?.practiceGoals ?? [],
    spokenLanguages,
    learningLanguages,
    nativeLanguages: spokenLanguages
      .filter((item) => item.proficiency === "NATIVE")
      .map((item) => item.name),
    settings: toUserSettingsDto(user.settings, profile?.discoverable),
    stats: user.stats,
  };
}

type PublicConversationContext = {
  /** Existing direct chat with the viewer, if any. */
  conversationId: string | null;
  isFollowing: boolean;
  followerCount: number;
  /** Already masked by the presence layer when the owner hides it. */
  onlineStatus: OnlineStatus;
};

/**
 * PRO-003 / PRO-001 — public profile DTO.
 * Built only from safe fields; never copies from CurrentUserDto (which includes email).
 */
export function toSafePublicProfileDto(
  user: PublicProfileSource,
  ctx: PublicConversationContext,
): SafePublicProfile {
  const profile = user.profile;
  const avatarUrl = resolveAvatarUrl(profile) ?? null;
  const location = visibleLocation(profile, user.settings);

  return {
    ...toShowcase(user, location.city, "public"),
    id: user.id,
    displayName: profile?.displayName ?? "",
    avatarUrl,
    profileImageUrl: avatarUrl,
    country: location.country,
    bio: profile?.bio ?? "",
    spokenLanguages: mapLanguages(user, "SPEAKS"),
    learningLanguages: mapLanguages(user, "LEARNING"),
    practiceGoals: profile?.practiceGoals ?? [],
    onlineStatus: ctx.onlineStatus,
    profileAnswers: profile?.profileAnswers ?? [],
    conversationId: ctx.conversationId,
    isFollowing: ctx.isFollowing,
    followerCount: ctx.followerCount,
    location: location.country ? coordinates(profile) : null,
  };
}

/**
 * Legacy GET /users/:id shape.
 * Still privacy-safe: no email, DOB, auth, or account flags.
 * Age is coarse public metadata (not DOB).
 */
export function toPublicProfileDto(
  user: PublicProfileSource,
  ctx: PublicConversationContext,
): PublicUserProfile {
  const profile = user.profile;
  const avatarUrl = resolveAvatarUrl(profile);

  return {
    id: user.id,
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    country: visibleLocation(profile, user.settings).country,
    photoUrl: avatarUrl,
    avatarUrl,
    age: profile ? currentAge(profile) : null,
    practiceGoals: profile?.practiceGoals ?? [],
    spokenLanguages: mapLanguages(user, "SPEAKS"),
    learningLanguages: mapLanguages(user, "LEARNING"),
    profileAnswers: profile?.profileAnswers ?? [],
    conversationId: ctx.conversationId,
    isFollowing: ctx.isFollowing,
    followerCount: ctx.followerCount,
  };
}

/** Runtime guard for tests / defensive checks on public JSON payloads. */
export function assertNoSensitivePublicFields(payload: Record<string, unknown>) {
  for (const key of FORBIDDEN_PUBLIC_PROFILE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined) {
      throw new Error(`Public profile payload must not include "${key}"`);
    }
  }
}
