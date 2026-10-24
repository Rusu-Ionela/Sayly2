import { StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { AppStackParamList } from "@/navigation/types";
import { PressableScale } from "@/shared/components/PressableScale";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type DiscoveryEmptyStateProps = {
  hasFilters: boolean;
  onClearFilters?: () => void;
};

export function DiscoveryEmptyState({ hasFilters, onClearFilters }: DiscoveryEmptyStateProps) {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  return (
    <WarmEmptyState
      title={
        hasFilters
          ? "No partners match these filters"
          : "Ready to practice. Start your first conversation!"
      }
      body={
        hasFilters
          ? "Try another name, language, country, or level. A looser search often finds a great match."
          : "Complete your profile and languages so partners can find you, then say hello."
      }
      action={
        hasFilters && onClearFilters ? (
          <PressableScale
            onPress={onClearFilters}
            style={[styles.action, { backgroundColor: colors.accentSoft }]}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>Clear filters</Text>
          </PressableScale>
        ) : !hasFilters ? (
          <PressableScale
            onPress={() => navigation.navigate("EditProfile")}
            style={[styles.action, { backgroundColor: colors.accentSoft }]}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>Edit profile</Text>
          </PressableScale>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  actionText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
