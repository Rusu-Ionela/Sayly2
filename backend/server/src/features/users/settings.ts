import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../db/client";
import { profiles, userSettings, type UserSettings } from "../../db/schema";

import type { UpdateSettingsInput, UserSettingsDto } from "./types";

type StoredSettings = Omit<UserSettings, "userId" | "updatedAt">;

/** Used when the user never changed a setting (no UserSettings row yet). */
export const DEFAULT_SETTINGS: StoredSettings = {
  showOnlineStatus: true,
  showLocation: true,
  notifyMessages: true,
  notifyConnectionRequests: true,
  notifyGroupActivity: true,
  showSaylyId: true,
  showCertificates: true,
  translateTo: null,
};

export function toUserSettingsDto(
  stored: StoredSettings | null | undefined,
  discoverable: boolean | undefined,
): UserSettingsDto {
  const settings = stored ?? DEFAULT_SETTINGS;
  return {
    discoverable: discoverable ?? true,
    showOnlineStatus: settings.showOnlineStatus,
    showLocation: settings.showLocation,
    notifyMessages: settings.notifyMessages,
    notifyConnectionRequests: settings.notifyConnectionRequests,
    notifyGroupActivity: settings.notifyGroupActivity,
    showSaylyId: settings.showSaylyId,
    showCertificates: settings.showCertificates,
    translateTo: settings.translateTo,
  };
}

/** Every stored settings column, for relational queries that load the settings row. */
export const SETTINGS_COLUMNS = {
  showOnlineStatus: true,
  showLocation: true,
  notifyMessages: true,
  notifyConnectionRequests: true,
  notifyGroupActivity: true,
  showSaylyId: true,
  showCertificates: true,
  translateTo: true,
} as const satisfies Record<keyof StoredSettings, true>;

/** Applies a partial settings patch atomically (Discover visibility lives on Profile). */
export async function updateSettings(userId: string, input: UpdateSettingsInput) {
  const { discoverable, ...rest } = input;
  const stored = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  ) as Partial<StoredSettings>;

  await db.transaction(async (tx) => {
    if (discoverable !== undefined) {
      await tx.update(profiles).set({ discoverable }).where(eq(profiles.userId, userId));
    }
    if (Object.keys(stored).length > 0) {
      await tx
        .insert(userSettings)
        .values({ userId, ...stored })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { ...stored, updatedAt: new Date() },
        });
    }
  });
}

/**
 * Country and city as other users may see them: "" / null when the owner turned
 * "Show my location" off. The one rule for every payload that describes someone else.
 */
export function visibleLocation(
  profile: { country?: string | null; city?: string | null } | null | undefined,
  settings: { showLocation: boolean } | null | undefined,
): { country: string; city: string | null } {
  if (settings?.showLocation === false) {
    return { country: "", city: null };
  }
  return { country: profile?.country ?? "", city: profile?.city ?? null };
}

/**
 * SQL form of `visibleLocation` for `Profile.country`, for queries that select columns
 * directly. Use in place of `profiles.country` whenever the row is someone else's.
 */
export const visibleCountry = sql<string>`case when exists (
  select 1 from ${userSettings}
  where ${userSettings.userId} = ${profiles.userId} and ${userSettings.showLocation} = false
) then '' else ${profiles.country} end`;

type VisibilitySetting = "showOnlineStatus" | "showLocation" | "showSaylyId";

/**
 * Of `userIds`, the ones who turned `setting` off. Users without a settings row use
 * the defaults (everything visible), so only explicit opt-outs are returned.
 */
export async function usersHiding(setting: VisibilitySetting, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(and(inArray(userSettings.userId, userIds), eq(userSettings[setting], false)));
  return new Set(rows.map((row) => row.userId));
}

/** The member's "Translate to" language, or null to use their native language. */
export async function getTranslateToSetting(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ translateTo: userSettings.translateTo })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row?.translateTo ?? null;
}
