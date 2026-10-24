import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

// Direct module imports keep languages independent of the profile screens.
import { useProfile, useUpdateSettings } from "@/features/profile/hooks/useProfile";
import type { AppStackParamList } from "@/navigation/types";
import { PressableScale } from "@/shared/components/PressableScale";
import { SectionCard } from "@/shared/components/SectionCard";
import { SettingRow } from "@/shared/components/SettingRow";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import type { Language } from "../types";
import { languageFlag } from "../utils";

import { LanguageCatalogModal } from "./LanguageCatalogModal";

/**
 * Below the language lists: the certificate shortcut and app-wide language settings
 * ("Translate to" for chat translations, App language).
 */
export function LanguageAppSettings({ catalog }: { catalog: Language[] }) {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const profile = useProfile().data;
  const { save } = useUpdateSettings({
    onError: (message) => Alert.alert("Could not update setting", message),
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const translateTo = profile?.settings.translateTo ?? null;
  const native = profile?.spokenLanguages.find((item) => item.proficiency === "NATIVE");
  const target = useMemo(
    () => (translateTo ? catalog.find((item) => item.code === translateTo) : undefined),
    [catalog, translateTo],
  );
  const translateLabel = target
    ? `${languageFlag(target)} ${target.name}`
    : native
      ? `${native.name} (native)`
      : "Your native language";

  return (
    <View>
      <PressableScale
        onPress={() => navigation.navigate("Certificates", { tab: "get" })}
        style={[styles.certify, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Certify your language level and earn a Sayly certificate"
      >
        <Ionicons name="shield-checkmark" size={26} color={colors.accent} />
        <Text style={[styles.certifyText, { color: colors.text }]}>
          Certify your language level and earn a Sayly certificate
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.accent} />
      </PressableScale>

      <SectionCard
        title="App settings"
        footer="Chat messages are translated into this language when you tap Translate."
      >
        <SettingRow
          kind="link"
          icon="language-outline"
          title="Translate to"
          value={translateLabel}
          onPress={() => setPickerOpen(true)}
          disabled={!profile}
        />
        {translateTo ? (
          <SettingRow
            kind="link"
            icon="refresh-outline"
            title="Use my native language"
            onPress={() => save({ translateTo: null })}
          />
        ) : null}
        <SettingRow
          kind="link"
          icon="phone-portrait-outline"
          title="App language"
          value="English"
          onPress={() =>
            Alert.alert(
              "App language",
              "Sayly is available in English for now. More app languages are coming.",
            )
          }
        />
      </SectionCard>

      <LanguageCatalogModal
        visible={pickerOpen}
        languages={catalog}
        selectedIds={new Set(target ? [target.id] : [])}
        disableSelected={false}
        title="Translate to"
        onSelect={(language) => {
          setPickerOpen(false);
          save({ translateTo: language.code });
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  certify: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
  },
  certifyText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
});
