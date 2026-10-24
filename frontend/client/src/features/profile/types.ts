import type { UserLanguageDto, UserLanguageSelection } from "@/features/languages/types";

import type { LearningPreferences } from "./model/learningPreferences";
import type { CefrLevel } from "./model/profileLimits";

/** Privacy + notification toggles (`settings` block of GET /users/me). */
export type UserSettings = {
  /** Listed in Discover. */
  discoverable: boolean;
  showOnlineStatus: boolean;
  /** When false, country and city are hidden from other users. */
  showLocation: boolean;
  notifyMessages: boolean;
  notifyConnectionRequests: boolean;
  notifyGroupActivity: boolean;
  /** When off, shared Sayly ID links to your profile stop working. */
  showSaylyId: boolean;
  /** When off, certificates are hidden on your public profile. */
  showCertificates: boolean;
  /** Language code chat translations default to; null = your native language. */
  translateTo: string | null;
};

/** The on/off settings (every key whose value is a boolean). */
export type ToggleSettingKey = {
  [K in keyof UserSettings]: UserSettings[K] extends boolean ? K : never;
}[keyof UserSettings];

/** PATCH /users/me/settings — send only the toggles that changed. */
export type UpdateSettingsPayload = Partial<UserSettings>;

/** Self-reported language certificate. */
export type Certificate = {
  id: string;
  languageId: string;
  languageName: string;
  flagEmoji: string;
  level: CefrLevel;
  title: string;
  issuedYear: number | null;
};

export type CertificateInput = Pick<Certificate, "languageId" | "level" | "title"> & {
  issuedYear?: number | null;
};

/** Same shape as the backend ReferenceSummaryDto. */
export type ReferenceSummary = { total: number; positive: number };

type ProfileStats = {
  savedPhrases: number;
  groups: number;
  following: number;
  /** Profile visits since you last opened Visitors. */
  newVisitors: number;
};

/** City-level position (about 1 km precision) used for the profile map. */
export type ProfileLocation = { latitude: number; longitude: number };

export type OnlineStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

/** Fields shown on a profile page, for both your own and someone else's profile. */
type ProfileShowcase = {
  isPro: boolean;
  city: string | null;
  topics: string[];
  /** Gallery image URLs in display order. */
  photos: string[];
  certificates: Certificate[];
  /** Main conversation topic, if set. */
  mainTopic: string | null;
  /** References from language partners — shown even when there are none. */
  references: ReferenceSummary;
  learningPreferences: LearningPreferences;
};

/**
 * PRO-003: private / self profile (GET /users/me) — profile, settings and stats in one
 * payload. May include email and DOB — never use this type for another user's profile UI.
 */
export type CurrentUserProfile = ProfileShowcase & {
  id: string;
  /** Shareable public code. */
  saylyId: string;
  email: string;
  onboardingCompleted: boolean;
  profileCompleted?: boolean;
  displayName: string;
  firstName?: string;
  lastName?: string;
  gender?: "MALE" | "FEMALE" | null;
  profileAnswers?: string[];
  bio: string;
  country: string;
  photoUrl?: string;
  profileImageUrl?: string;
  avatarUrl?: string;
  dateOfBirth: string | null;
  age: number | null;
  practiceGoals: string[];
  spokenLanguages: UserLanguageDto[];
  learningLanguages: UserLanguageDto[];
  nativeLanguages: string[];
  location: ProfileLocation | null;
  settings: UserSettings;
  stats: ProfileStats;
};

export type CompleteOnboardingPayload = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  gender?: "MALE" | "FEMALE";
  bio?: string;
  country?: string;
  age?: number;
  dateOfBirth?: string;
  profileImageUrl?: string;
  spokenLanguages: UserLanguageSelection[];
  learningLanguages: UserLanguageSelection[];
  practiceGoals?: string[];
  profileAnswers?: string[];
};

/**
 * PRO-003 / PRO-001: public profile only.
 * No email, password, DOB, auth provider, tokens, or account flags.
 * Country/city are empty and status is UNKNOWN when the owner hides them.
 */
export type PublicUserProfile = ProfileShowcase & {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  profileImageUrl?: string | null;
  country: string;
  bio: string;
  profileAnswers?: string[];
  spokenLanguages: UserLanguageDto[];
  learningLanguages: UserLanguageDto[];
  practiceGoals: string[];
  onlineStatus: OnlineStatus;
  conversationId: string | null;
  isFollowing: boolean;
  followerCount: number;
  location: ProfileLocation | null;
};

/**
 * PRO-002 PUT /users/me/profile body. Send only changed fields;
 * spoken + learning languages must always be sent together.
 */
export type UpdateProfilePayload = {
  displayName?: string;
  bio?: string;
  country?: string;
  /** "" removes the city. */
  city?: string;
  dateOfBirth?: string;
  /**
   * http(s) URL, server `/media/...` path, or `data:image/(jpeg|png|webp);base64,...`
   * (max 2 MB decoded). `null` removes the photo.
   */
  avatarUrl?: string | null;
  practiceGoals?: string[];
  topics?: string[];
  /** Full ordered gallery of uploaded `/media/...` paths. */
  photos?: string[];
  /** Full certificate list — replaces the current one. */
  certificates?: CertificateInput[];
  spokenLanguages?: UserLanguageSelection[];
  learningLanguages?: UserLanguageSelection[];
  /** Only the preferences that are sent change. */
  learningPreferences?: Partial<LearningPreferences>;
};
