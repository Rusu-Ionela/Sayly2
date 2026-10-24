import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { findCatalogLanguage, languageFlag } from "@/features/languages/utils";
import type { Language } from "@/features/languages/types";
import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

import type { DiscoverLanguage, DiscoveryUser } from "../types";
import { partnerAvatarUrl } from "../utils";

type UserCardProps = {
  user: DiscoveryUser;
  languageCatalog: Language[];
  onPress?: (userId: string) => void;
  onConnect?: (user: DiscoveryUser) => void;
  busy?: boolean;
};

function FlagGroup({
  label,
  languages,
  catalog,
}: {
  label: string;
  languages: DiscoverLanguage[];
  catalog: Language[];
}) {
  const colors = useColors();
  const first = languages[0];
  if (!first) return null;
  const extra = languages.length - 1;
  const entry = findCatalogLanguage(catalog, first.languageId);

  return (
    <View style={styles.flagGroup}>
      <Text style={[styles.flagLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={styles.flag}>
        {entry ? languageFlag(entry) : first.flagEmoji?.trim() || "🏳️"}
      </Text>
      {extra > 0 ? <Text style={[styles.flagLabel, { color: colors.muted }]}>+{extra}</Text> : null}
    </View>
  );
}

function UserDiscoveryCardComponent({
  user,
  languageCatalog,
  onPress,
  onConnect,
  busy,
}: UserCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <PressableScale
        onPress={() => onPress?.(user.id)}
        style={styles.press}
        accessibilityRole="button"
        accessibilityLabel={`${user.displayName}. ${user.bio || user.matchLabel}`}
      >
        <Avatar uri={partnerAvatarUrl(user)} name={user.displayName} size={100} square />
        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {user.displayName}
          </Text>
          {user.bio ? (
            <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={3}>
              {user.bio}
            </Text>
          ) : null}
          <View style={styles.flags}>
            <FlagGroup label="NATIVE" languages={user.spokenLanguages} catalog={languageCatalog} />
            <FlagGroup
              label="LEARNS"
              languages={user.learningLanguages}
              catalog={languageCatalog}
            />
          </View>
        </View>
      </PressableScale>
      <PressableScale
        onPress={() => onConnect?.(user)}
        disabled={busy}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel={`Connect with ${user.displayName}`}
      >
        <Ionicons name="person-add-outline" size={24} color={colors.accent} />
      </PressableScale>
    </View>
  );
}

export const UserDiscoveryCard = memo(UserDiscoveryCardComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  press: { flex: 1, flexDirection: "row", gap: 16, minWidth: 0 },
  body: { flex: 1, minWidth: 0, minHeight: 100, justifyContent: "space-between", gap: 4 },
  name: { fontSize: 17, fontWeight: "600" },
  bio: { fontSize: 16, lineHeight: 22 },
  flags: { flexDirection: "row", gap: 16, marginTop: 6 },
  flagGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  flagLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  flag: { fontSize: 16 },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
