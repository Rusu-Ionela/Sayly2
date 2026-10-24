import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import type { CefrLevel } from "../model/profileLimits";

/** Display shape shared by saved certificates and form entries (resolved names). */
export type CertificateRowData = {
  key: string;
  flagEmoji: string;
  languageName: string;
  level: CefrLevel;
  title: string;
  issuedYear: number | null;
};

type CertificateListProps = {
  items: readonly CertificateRowData[];
  /** Edit mode: shows a remove button per row. */
  onRemove?: (key: string) => void;
};

/** Language certificates (self-reported): flag, language, CEFR level, name and year. */
export const CertificateList = memo(function CertificateList({
  items,
  onRemove,
}: CertificateListProps) {
  const colors = useColors();
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <Text style={styles.flag}>{item.flagEmoji || "🌐"}</Text>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
              {item.languageName}
              {item.issuedYear ? ` · ${item.issuedYear}` : ""}
            </Text>
          </View>
          <View style={[styles.level, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.levelText, { color: colors.accent }]}>{item.level}</Text>
          </View>
          {onRemove ? (
            <Pressable
              onPress={() => onRemove(item.key)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.title}`}
            >
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  flag: {
    fontSize: 22,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
  },
  level: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
