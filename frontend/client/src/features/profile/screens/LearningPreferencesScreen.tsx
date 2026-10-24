import { Ionicons } from "@expo/vector-icons";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip } from "@/shared/components/Chip";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { WarmLoadingView } from "@/shared/components/WarmLoadingView";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { useProfile, useUpdateProfile } from "../hooks/useProfile";
import {
  LEARNING_PREFERENCE_GROUPS,
  isSelected,
  togglePreference,
} from "../model/learningPreferences";

/**
 * Communication, time commitment, learning schedule and corrections. Every tap saves
 * right away (shown instantly, rolled back if it fails). Visible on your public profile.
 */
export function LearningPreferencesScreen() {
  const colors = useColors();
  const profileQuery = useProfile();
  const { save } = useUpdateProfile({
    onError: (message) => Alert.alert("Could not save", message),
  });
  const profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return (
      <Screen includeBottomInset>
        <WarmLoadingView />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="Could not load your preferences"
          body="Check your connection and try again."
          onAction={() => void profileQuery.refetch()}
        />
      </Screen>
    );
  }

  const preferences = profile.learningPreferences;

  return (
    <Screen includeBottomInset>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.muted }]}>
          Help partners know what to expect. These show on your profile.
        </Text>

        {LEARNING_PREFERENCE_GROUPS.map((group) => (
          <SectionCard key={group.key} variant="content" footer={group.hint}>
            <View style={styles.heading}>
              <Ionicons name={group.icon} size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                {group.title}
              </Text>
            </View>
            <View style={styles.chips}>
              {group.options.map((option) => {
                const selected = isSelected(preferences, group.key, option.id);
                return (
                  <Chip
                    key={option.id}
                    label={option.label}
                    selected={selected}
                    icon={selected ? "checkmark" : undefined}
                    onPress={() =>
                      save({
                        learningPreferences: togglePreference(preferences, group.key, option.id),
                      })
                    }
                    accessibilityLabel={`${group.title}: ${option.label}`}
                  />
                );
              })}
            </View>
          </SectionCard>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  intro: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
