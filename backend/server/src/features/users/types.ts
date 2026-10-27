import type {
  PracticeGoal,
  ReferenceSummaryDto,
  Topic,
  UpdateSettingsInput,
  UserSettingsDto,
} from "@sayly/shared";
import type { CefrLevel, ProficiencyLevel, UserLanguageType } from "../../db/schema";

import type { SyncUserLanguagesInput } from "../languages/types";

import type { AvatarInput } from "./avatar";
import type { LearningPreferencesDto, LearningPreferencesInput } from "./learningPreferences";

export type UserLanguageDto = {
  languageId: string;
  code: string;
  name: string;
  flagEmoji: string;
  proficiency: ProficiencyLevel;
};

/** PATCH /users/me/settings keys — also the `settings` block of GET /users/me. */
export type { UpdateSettingsInput, UserSettingsDto };

/** Self-reported language certificate. */
export type CertificateDto = {
  id: string;
  languageId: string;
  languageName: string;
  flagEmoji: string;
  level: CefrLevel;
  title: string;
  issuedYear: number | null;
};

export type CertificateInput = {
  languageId: string;
  level: CefrLevel;
  title: string;
  issuedYear?: number | null;
};

export type ProfileStatsDto = {
  savedPhrases: number;
  groups: number;
  following: number;
  /** Profile visits since the owner last opened their Visitors list. */
  newVisitors: number;
};

export type OnlineStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

/** Profile-page fields shared by the self and public profile payloads. */
type ProfileShowcase = {
  isPro: boolean;
  city: string | null;
  topics: string[];
  /** Signed gallery URLs, in display order. */
  photos: string[];
  certificates: CertificateDto[];
  /** The member's main conversation topic, if they set one. */
  mainTopic: string | null;
  /** References from language partners — on every profile, even when there are none. */
  references: ReferenceSummaryDto;
  learningPreferences: LearningPreferencesDto;
};

export type CurrentUserDto = ProfileShowcase & {
  id: string;
  /** Shareable public code ("Sayly ID"). */
  saylyId: string;
  email: string;
  onboardingCompleted: boolean;
  profileCompleted: boolean;
  displayName: string;
  bio: string;
  country: string;
  /** @deprecated Prefer avatarUrl / profileImageUrl */
  photoUrl?: string;
  profileImageUrl?: string;
  avatarUrl?: string;
  dateOfBirth: string | null;
  age: number | null;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE" | null;
  profileAnswers: string[];
  location: { latitude: number; longitude: number } | null;
  practiceGoals: string[];
  spokenLanguages: UserLanguageDto[];
  learningLanguages: UserLanguageDto[];
  nativeLanguages: string[];
  settings: UserSettingsDto;
  stats: ProfileStatsDto;
};

/** Legacy public profile used by GET /users/:id (FE-compatible lowercase status). */
export type PublicUserProfile = {
  id: string;
  displayName: string;
  bio: string;
  country: string;
  photoUrl?: string;
  avatarUrl?: string;
  age: number | null;
  practiceGoals: string[];
  spokenLanguages: UserLanguageDto[];
  learningLanguages: UserLanguageDto[];
  profileAnswers: string[];
  conversationId: string | null;
  isFollowing: boolean;
  followerCount: number;
};

/**
 * PRO-001 safe public profile — no email, DOB, hashes, or moderation internals.
 * Country/city are "" / null and status is UNKNOWN when the owner hides them.
 */
export type SafePublicProfile = ProfileShowcase & {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  profileImageUrl: string | null;
  country: string;
  bio: string;
  spokenLanguages: UserLanguageDto[];
  learningLanguages: UserLanguageDto[];
  practiceGoals: string[];
  onlineStatus: OnlineStatus;
  profileAnswers: string[];
  conversationId: string | null;
  /** Whether the viewer follows this member. */
  isFollowing: boolean;
  followerCount: number;
  location: { latitude: number; longitude: number } | null;
};

export type OnboardingLanguageInput = {
  languageId: string;
  proficiency: ProficiencyLevel;
};

/** Persisted while a member works through onboarding; full validation happens on completion. */
export type OnboardingDraftInput = {
  step:
    | "profile"
    | "gender"
    | "hello"
    | "nativePrompt"
    | "nativePick"
    | "fluentPrompt"
    | "fluentPick"
    | "learnPrompt"
    | "learnPick"
    | "questions"
    | "country"
    | "photo";
  questionIndex: number;
  draft: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: "MALE" | "FEMALE" | null;
    skipFluent: boolean;
    spokenLanguages: OnboardingLanguageInput[];
    learningLanguages: OnboardingLanguageInput[];
    answers: [string, string, string];
    country: string;
  };
};

export type CompleteOnboardingInput = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  gender?: "MALE" | "FEMALE";
  bio?: string;
  country?: string;
  age?: number;
  dateOfBirth?: Date;
  profileImageUrl?: string;
  spokenLanguages: OnboardingLanguageInput[];
  learningLanguages: OnboardingLanguageInput[];
  practiceGoals?: string[];
  profileAnswers?: string[];
};

/** PRO-002 — parsed edit-profile payload (PUT /users/me/profile and PATCH /users/me). */
export type UpdateProfileInput = {
  displayName?: string;
  bio?: string;
  country?: string;
  /** null = clear. */
  city?: string | null;
  dateOfBirth?: Date;
  /** undefined = keep, null = clear. */
  avatar?: AvatarInput | null;
  practiceGoals?: PracticeGoal[];
  topics?: Topic[];
  /** Full ordered gallery (stable media paths) — replaces the current one. */
  photos?: string[];
  /** Full certificate list — replaces the current one. */
  certificates?: CertificateInput[];
  /** Spoken + learning are always replaced together. */
  languages?: SyncUserLanguagesInput;
  /** Only the preferences that were sent change. */
  learningPreferences?: LearningPreferencesInput;
};

export type { ProficiencyLevel, UserLanguageType };
