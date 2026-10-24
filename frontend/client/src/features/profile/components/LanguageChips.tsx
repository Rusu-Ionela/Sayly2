import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatProficiencyLabel } from "@/features/languages/model/proficiency";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { getTypography } from "@/shared/theme/typography";

type LanguageChipItem = {
  languageId: string;
  name: string;
  proficiency: string;
  flagEmoji?: string;
};

type LanguageChipsProps = {
  items: LanguageChipItem[];
  /** spoken = languages you offer, learning = languages you practice. */
  tone?: "spoken" | "learning";
  title?: string;
  emptyLabel?: string;
  /** Smaller chips without a section title — used in the profile header. */
  compact?: boolean;
};

type LanguageChipProps = Omit<LanguageChipItem, "languageId"> & {
  tone: "spoken" | "learning";
  compact: boolean;
};

const LanguageChip = memo(function LanguageChip({
  name,
  proficiency,
  flagEmoji,
  tone,
  compact,
}: LanguageChipProps) {
  const colors = useColors();
  const learning = tone === "learning";
  const label = formatProficiencyLabel(proficiency);

  return (
    <View
      style={[
        styles.chip,
        compact && styles.chipCompact,
        { backgroundColor: learning ? colors.chipLearningBg : colors.chipSpokenBg },
      ]}
      accessibilityLabel={`${learning ? "Learning" : "Speaks"} ${name}, ${label}`}
    >
      <Text
        style={[
          styles.text,
          compact && styles.textCompact,
          { color: learning ? colors.chipLearningText : colors.chipSpokenText },
        ]}
      >
        {flagEmoji ? `${flagEmoji} ` : ""}
        {name} · {label}
      </Text>
    </View>
  );
});

/** PRO-001 / PRO-002 — one chip list for spoken and learning languages, on every profile surface. */
export const LanguageChips = memo(function LanguageChips({
  items,
  tone = "spoken",
  title,
  emptyLabel = "None listed",
  compact = false,
}: LanguageChipsProps) {
  const colors = useColors();
  const type = getTypography(colors);

  if (compact && items.length === 0) {
    return null;
  }

  return (
    <View style={compact ? undefined : styles.section}>
      {title ? <Text style={type.sectionLabel}>{title}</Text> : null}
      <View style={[styles.row, compact && styles.rowCompact]}>
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>{emptyLabel}</Text>
        ) : (
          items.map((item) => (
            <LanguageChip
              key={item.languageId}
              name={item.name}
              proficiency={item.proficiency}
              flagEmoji={item.flagEmoji}
              tone={tone}
              compact={compact}
            />
          ))
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Spacing between sections comes from the surrounding SectionCard.
  section: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rowCompact: {
    justifyContent: "center",
    gap: 6,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  textCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  empty: {
    fontWeight: "500",
  },
});
