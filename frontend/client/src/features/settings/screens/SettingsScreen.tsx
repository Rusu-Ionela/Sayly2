import { ScrollView, StyleSheet } from "react-native";

// Direct module import (not the profile barrel) avoids a profile ⇄ settings barrel cycle.
import { useProfile } from "@/features/profile/hooks/useProfile";
import { Screen } from "@/shared/components/Screen";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { WarmLoadingView } from "@/shared/components/WarmLoadingView";
import { spacing } from "@/shared/theme/spacing";

import { SettingsSections } from "../components/SettingsSections";
import { SETTINGS_SCREEN_SECTIONS } from "../model/settingsSections";

/** Gear on the Profile tab: notifications, appearance, blocked members and account. */
export function SettingsScreen() {
  const profileQuery = useProfile();
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
          title="Could not load your settings"
          body="Check your connection and try again."
          onAction={() => void profileQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen includeBottomInset>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSections profile={profile} sections={SETTINGS_SCREEN_SECTIONS} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
});
