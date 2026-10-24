import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UserLanguageDto } from "@/features/languages/types";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { countryFlagEmoji, findCountryByName } from "@/shared/data/countries";
import { Avatar } from "@/shared/components/Avatar";
import { ImageViewerModal } from "@/shared/components/ImageViewerModal";
import { ProBadge } from "@/shared/components/ProBadge";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";

import type { OnlineStatus } from "../types";

import { LanguageChips } from "./LanguageChips";

type ProfileHeaderProps = {
  displayName: string;
  country: string;
  city?: string | null;
  isPro?: boolean;
  /** Omit on your own profile; UNKNOWN (hidden by the owner or unavailable) shows nothing. */
  onlineStatus?: OnlineStatus;
  /** Overrides the "Online" / "Offline" text next to the dot (e.g. "Status hidden"). */
  statusLabel?: string;
  avatarUrl?: string | null;
  spokenLanguages?: UserLanguageDto[];
  learningLanguages?: UserLanguageDto[];
  size?: number;
  /** Replaces the tappable avatar — EditProfile passes an ImagePickerAvatar here. */
  avatarSlot?: ReactNode;
  /** Quick actions under the languages (e.g. Edit profile). */
  actions?: ReactNode;
  /** Your own Sayly ID, shown under the name (own profile only). */
  saylyId?: string | null;
};

const MAX_PRIMARY_LEARNING = 2;

function resolveCountryFlag(country: string) {
  const trimmed = country.trim();
  if (!trimmed) {
    return "🌍";
  }
  const byName = findCountryByName(trimmed);
  if (byName) {
    return countryFlagEmoji(byName.code);
  }
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return countryFlagEmoji(trimmed);
  }
  return "🌍";
}

/** Native language(s) — or the first spoken one — plus the top learning languages. */
function primaryLanguages(spoken: UserLanguageDto[], learning: UserLanguageDto[]) {
  const natives = spoken.filter((item) => item.proficiency === "NATIVE");
  return {
    spoken: natives.length > 0 ? natives : spoken.slice(0, 1),
    learning: learning.slice(0, MAX_PRIMARY_LEARNING),
  };
}

/** PRO-001 / PRO-002 — avatar, name, Pro badge, status, location and main languages. */
export const ProfileHeader = memo(function ProfileHeader({
  displayName,
  country,
  city,
  isPro = false,
  onlineStatus,
  statusLabel,
  avatarUrl,
  spokenLanguages = [],
  learningLanguages = [],
  size = 96,
  avatarSlot,
  actions,
  saylyId,
}: ProfileHeaderProps) {
  const colors = useColors();
  const type = getTypography(colors);
  const [viewerOpen, setViewerOpen] = useState(false);

  const flag = useMemo(() => resolveCountryFlag(country), [country]);
  const primary = useMemo(
    () => primaryLanguages(spokenLanguages, learningLanguages),
    [spokenLanguages, learningLanguages],
  );
  const location = [city, country].filter(Boolean).join(", ");
  const showStatus = onlineStatus === "ONLINE" || onlineStatus === "OFFLINE";

  const openViewer = useCallback(() => setViewerOpen(true), []);
  const closeViewer = useCallback(() => setViewerOpen(false), []);
  const fullImage = resolveMediaUrl(avatarUrl) ?? null;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.avatarWrap}>
        {avatarSlot ?? (
          <Pressable
            onPress={openViewer}
            disabled={!fullImage}
            accessibilityRole={fullImage ? "imagebutton" : "image"}
            accessibilityLabel={fullImage ? `View ${displayName}'s photo` : undefined}
          >
            <Avatar uri={avatarUrl} name={displayName} size={size} />
          </Pressable>
        )}
      </View>

      <View style={styles.nameRow}>
        <Text style={[type.cardTitle, styles.name]} numberOfLines={2}>
          {displayName || "Your name"}
        </Text>
        <Text style={styles.flag}>{flag}</Text>
      </View>

      {isPro || showStatus ? (
        <View style={styles.metaRow}>
          {isPro ? <ProBadge /> : null}
          {showStatus ? (
            <View style={styles.status}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: onlineStatus === "ONLINE" ? colors.presence : colors.muted },
                ]}
              />
              <Text style={[styles.statusText, { color: colors.muted }]}>
                {statusLabel ?? (onlineStatus === "ONLINE" ? "Online" : "Offline")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.location, { color: colors.muted }]}>
        {location || "Somewhere in the world"}
      </Text>

      {saylyId ? (
        <Text
          style={[styles.saylyId, { color: colors.muted }]}
          accessibilityLabel={`Your Sayly ID is ${saylyId.split("").join(" ")}`}
          selectable
        >
          Sayly ID · <Text style={{ color: colors.text }}>{saylyId}</Text>
        </Text>
      ) : null}

      <View style={styles.languages}>
        <LanguageChips items={primary.spoken} tone="spoken" compact />
        <LanguageChips items={primary.learning} tone="learning" compact />
      </View>

      {actions ? <View style={styles.actions}>{actions}</View> : null}

      {avatarSlot ? null : (
        <ImageViewerModal uri={viewerOpen ? fullImage : null} onClose={closeViewer} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 2,
    gap: 6,
  },
  avatarWrap: {
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.sm,
  },
  name: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
  },
  flag: {
    fontSize: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  location: {
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  saylyId: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  languages: {
    marginTop: 6,
    gap: 6,
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: "stretch",
  },
});
