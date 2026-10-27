/** Privacy and notification toggles (the `settings` block of GET /users/me). */
export type UserSettingsDto = {
  /** Listed in Discover (stored on Profile, edited only through settings). */
  discoverable: boolean;
  showOnlineStatus: boolean;
  /** When false, country and city are hidden from other users. */
  showLocation: boolean;
  notifyMessages: boolean;
  notifyConnectionRequests: boolean;
  notifyGroupActivity: boolean;
  /** Evening push when today's activity is still missing and the streak would break. */
  notifyStreakReminders: boolean;
  /** When false, shared Sayly ID links to this profile stop working. */
  showSaylyId: boolean;
  /** When false, certificates are hidden on the public profile. */
  showCertificates: boolean;
  /** Language code chat translations default to; null = your native language. */
  translateTo: string | null;
};

/** PATCH /users/me/settings — send only what changed. */
export type UpdateSettingsInput = Partial<UserSettingsDto>;
