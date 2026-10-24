import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth } from "@/features/auth";
// Direct module imports (not the profile barrel) avoid a profile ⇄ settings barrel cycle.
import { useUpdateSettings } from "@/features/profile/hooks/useProfile";
import type { CurrentUserProfile } from "@/features/profile/types";
import { useBlockedUsers, useDeleteAccount } from "@/features/safety";
import { showProInfo } from "@/features/subscription";
import { rateApp } from "@/features/support";
import type { AppStackParamList } from "@/navigation/types";
import { Button } from "@/shared/components/Button";
import { SectionCard } from "@/shared/components/SectionCard";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { SettingRow } from "@/shared/components/SettingRow";
import { useColors, useTheme } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { openExternalUrl } from "@/shared/utils/openExternal";

import { useDownloadMyData } from "../hooks/useDownloadMyData";
import type { SettingsAction, SettingsSection } from "../model/settingsSections";
import { ChangePasswordSheet } from "./ChangePasswordSheet";

const JOBS_URL = "https://sayly.app/jobs";

const APPEARANCE_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Auto" },
] as const;

function alertSettingFailed(message: string) {
  Alert.alert("Could not update setting", message);
}

type SettingsSectionsProps = {
  profile: CurrentUserProfile;
  sections: SettingsSection[];
  /** The Profile tab ends with Sign out. */
  showSignOut?: boolean;
};

/**
 * Renders settings sections (rows, toggles, links, appearance) with their actions. Used by
 * the lower half of the Profile tab and by the Settings screen, so no row exists twice.
 */
export function SettingsSections({
  profile,
  sections,
  showSignOut = false,
}: SettingsSectionsProps) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const { preference, setPreference } = useTheme();
  const { signOut } = useAuth();
  const { save } = useUpdateSettings({ onError: alertSettingFailed });
  const deleteAccount = useDeleteAccount();
  const downloadData = useDownloadMyData();
  const blockedCount = useBlockedUsers().data?.items.length;
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { isPro, settings } = profile;

  const actions = useMemo<Record<SettingsAction, () => void>>(
    () => ({
      rateUs: () => void rateApp(),
      reportBug: () => navigation.navigate("SupportForm", { kind: "bug" }),
      requestFeature: () => navigation.navigate("SupportForm", { kind: "feature" }),
      communityGuidelines: () => navigation.navigate("Guidelines", { kind: "community" }),
      partyGuidelines: () => navigation.navigate("Guidelines", { kind: "parties" }),
      faq: () => navigation.navigate("Faq"),
      contactUs: () => navigation.navigate("SupportForm", { kind: "contact" }),
      aboutUs: () => navigation.navigate("AboutUs"),
      termsOfService: () => navigation.navigate("TermsOfService"),
      privacyPolicy: () => navigation.navigate("PrivacyPolicy"),
      imprint: () => navigation.navigate("Imprint"),
      jobs: () => openExternalUrl(JOBS_URL, "Jobs", `See open roles at ${JOBS_URL}`),
      blockedUsers: () => navigation.navigate("BlockedUsers"),
      subscription: () => showProInfo(isPro),
      changePassword: () => setPasswordOpen(true),
      downloadData: () =>
        Alert.alert(
          "Download my data",
          "We'll put together your profile, topics, collection, follows, references and sent messages so you can save or share them.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Download", onPress: () => downloadData.mutate() },
          ],
        ),
      deleteAccount: () =>
        Alert.alert(
          "Delete account",
          "Your profile, photos, certificates and settings are removed and you are hidden from Discover. This cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () =>
                deleteAccount.mutate(undefined, {
                  onSuccess: () =>
                    Alert.alert("Account deleted", "Your Sayly account has been deactivated.", [
                      { text: "OK", onPress: () => void signOut() },
                    ]),
                  onError: () => Alert.alert("Could not delete account", "Please try again."),
                }),
            },
          ],
        ),
    }),
    [deleteAccount, downloadData, isPro, navigation, signOut],
  );

  const confirmSignOut = () =>
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  const linkValue = (action: SettingsAction) => {
    if (action === "subscription") return isPro ? "Active" : "Upgrade";
    if (action === "blockedUsers" && blockedCount !== undefined) return String(blockedCount);
    return undefined;
  };

  const renderSection = (section: SettingsSection) => {
    if (section.kind === "appearance") {
      return (
        <SectionCard key={section.id} title={section.title} variant="content">
          <SegmentedControl
            options={APPEARANCE_OPTIONS}
            value={preference}
            onChange={setPreference}
            accessibilitySuffix="appearance"
          />
        </SectionCard>
      );
    }

    return (
      <SectionCard key={section.id} title={section.title} footer={section.footer}>
        {section.items.map((item) =>
          item.kind === "external" ? (
            <SettingRow
              key={item.id}
              kind="link"
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => openExternalUrl(item.url, item.title)}
              trailing={<Ionicons name="open-outline" size={18} color={colors.muted} />}
            />
          ) : item.kind === "toggle" ? (
            <SettingRow
              key={item.key}
              kind="toggle"
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              value={settings[item.key]}
              onValueChange={(next) => save({ [item.key]: next })}
            />
          ) : (
            <SettingRow
              key={item.action}
              kind="link"
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              tone={item.tone}
              value={linkValue(item.action)}
              onPress={actions[item.action]}
              loading={
                (item.action === "deleteAccount" && deleteAccount.isPending) ||
                (item.action === "downloadData" && downloadData.isPending)
              }
            />
          ),
        )}
      </SectionCard>
    );
  };

  return (
    <>
      {sections.map(renderSection)}

      {showSignOut ? (
        <View style={styles.signOut}>
          <Button label="Sign out" tone="danger" onPress={confirmSignOut} />
        </View>
      ) : null}

      <ChangePasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  signOut: {
    marginTop: spacing.lg,
  },
});
