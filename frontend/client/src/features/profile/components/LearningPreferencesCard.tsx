import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { SectionCard } from "@/shared/components/SectionCard";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { describePreferences, type LearningPreferences } from "../model/learningPreferences";

/** Public profile: how this member likes to practise. Hidden when nothing is set. */
export function LearningPreferencesCard({ preferences }: { preferences: LearningPreferences }) {
  const colors = useColors();
  const groups = describePreferences(preferences);
  if (groups.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Learning preferences" variant="content">
      {groups.map((group) => (
        <View
          key={group.key}
          style={styles.row}
          accessible
          accessibilityLabel={`${group.title}: ${group.labels.join(", ")}`}
        >
          <Ionicons name={group.icon} size={20} color={colors.accent} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.muted }]}>{group.title}</Text>
            <Text style={[styles.value, { color: colors.text }]}>{group.labels.join(", ")}</Text>
          </View>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
  },
  value: {
    fontSize: 15,
    lineHeight: 21,
  },
});
