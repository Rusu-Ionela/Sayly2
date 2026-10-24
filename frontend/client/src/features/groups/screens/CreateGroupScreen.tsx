import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";

import { useLanguages } from "@/features/languages";
import { LanguageCatalogModal } from "@/features/languages/components/LanguageCatalogModal";
import { formatProficiencyLabel } from "@/features/languages/model/proficiency";
import type { Language, ProficiencyLevel } from "@/features/languages/types";
import { PRACTICE_GOALS } from "@/features/profile/model/practiceGoals";
import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { Chip } from "@/shared/components/Chip";
import { PressableScale } from "@/shared/components/PressableScale";
import { Screen } from "@/shared/components/Screen";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";

import { useCreateGroup } from "../hooks/useGroups";
import type { GroupVisibility } from "../types";

const LEVELS: ProficiencyLevel[] = [
  "BEGINNER",
  "ELEMENTARY",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "ADVANCED",
];
const CAPACITIES = [20, 50, 200];

function Field({
  label,
  hint,
  value,
  onChange,
  maxLength,
  multiline,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  const colors = useColors();
  const type = getTypography(colors);
  return (
    <View style={styles.field}>
      <Text style={type.sectionLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder },
        ]}
      />
      <Text style={[styles.hint, { color: colors.muted }]}>
        {hint ? `${hint} · ` : ""}
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

export function CreateGroupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const type = getTypography(colors);
  const catalog = useLanguages();
  const create = useCreateGroup();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<Language | null>(null);
  const [level, setLevel] = useState<ProficiencyLevel | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [audience, setAudience] = useState("");
  const [rules, setRules] = useState("");
  const [visibility, setVisibility] = useState<GroupVisibility>("PUBLIC");
  const [maxMembers, setMaxMembers] = useState(50);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(language ? [language.id] : []), [language]);
  const canSubmit = name.trim().length >= 3 && Boolean(language) && !create.isPending;

  const submit = () => {
    if (!language || !canSubmit) return;
    setError(null);
    create.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        languageId: language.id,
        level,
        topic,
        audience: audience.trim(),
        rules: rules.trim(),
        visibility,
        maxMembers,
      },
      {
        onSuccess: (group) => navigation.replace("GroupDetail", { groupId: group.id }),
        onError: (err) =>
          setError(isApiError(err) ? err.message : "Could not create the group. Please try again."),
      },
    );
  };

  return (
    <Screen includeBottomInset>
      <KeyboardSafeView style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={type.screenSubtitle}>
            Give learners a place to practice together. You’ll be the owner and can add moderators
            later.
          </Text>

          <Field
            label="Group name"
            value={name}
            onChange={setName}
            maxLength={60}
            placeholder="e.g. Russian for Hindi speakers"
            hint="At least 3 characters"
          />

          <View style={styles.field}>
            <Text style={type.sectionLabel}>Language practiced</Text>
            <PressableScale
              onPress={() => setPickerOpen(true)}
              style={[
                styles.input,
                styles.picker,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                language ? `Language: ${language.name}. Change` : "Choose a language"
              }
            >
              <View style={styles.pickerRow}>
                <Text
                  style={[
                    styles.pickerText,
                    { color: language ? colors.text : colors.placeholder },
                  ]}
                >
                  {language
                    ? `${language.flagEmoji ?? ""} ${language.name}`.trim()
                    : "Choose a language"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.muted} />
              </View>
            </PressableScale>
          </View>

          <View style={styles.field}>
            <Text style={type.sectionLabel}>Level</Text>
            <View style={styles.chips}>
              <Chip label="All levels" selected={level === null} onPress={() => setLevel(null)} />
              {LEVELS.map((item) => (
                <Chip
                  key={item}
                  label={formatProficiencyLabel(item)}
                  selected={level === item}
                  onPress={() => setLevel(item)}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={type.sectionLabel}>Focus</Text>
            <View style={styles.chips}>
              {PRACTICE_GOALS.map((goal) => (
                <Chip
                  key={goal}
                  label={goal}
                  selected={topic === goal}
                  onPress={() => setTopic(topic === goal ? null : goal)}
                />
              ))}
            </View>
          </View>

          <Field
            label="Description"
            value={description}
            onChange={setDescription}
            maxLength={600}
            multiline
            placeholder="What will members practice? How often do you meet?"
          />
          <Field
            label="Who is it for?"
            value={audience}
            onChange={setAudience}
            maxLength={120}
            placeholder="e.g. Hindi speakers learning Russian"
          />
          <Field
            label="Group rules (optional)"
            value={rules}
            onChange={setRules}
            maxLength={1000}
            multiline
            placeholder="e.g. Be kind. Corrections welcome. Russian only on Fridays."
          />

          <View style={styles.field}>
            <Text style={type.sectionLabel}>Who can join</Text>
            <View style={styles.chips}>
              <Chip
                icon="earth"
                label="Public — anyone can join"
                selected={visibility === "PUBLIC"}
                onPress={() => setVisibility("PUBLIC")}
              />
              <Chip
                icon="lock-closed"
                label="Private — you approve requests"
                selected={visibility === "PRIVATE"}
                onPress={() => setVisibility("PRIVATE")}
              />
            </View>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Discussions and member lists are only visible to members either way.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={type.sectionLabel}>Member limit</Text>
            <View style={styles.chips}>
              {CAPACITIES.map((value) => (
                <Chip
                  key={value}
                  label={`${value} members`}
                  selected={maxMembers === value}
                  onPress={() => setMaxMembers(value)}
                />
              ))}
            </View>
          </View>

          {error ? (
            <Text style={[styles.error, { color: colors.error }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <PressableScale
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.submit, { backgroundColor: canSubmit ? colors.accent : colors.trail }]}
            accessibilityRole="button"
            accessibilityLabel="Create group"
            accessibilityState={{ disabled: !canSubmit, busy: create.isPending }}
          >
            {create.isPending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text
                style={[styles.submitText, { color: canSubmit ? colors.onPrimary : colors.muted }]}
              >
                Create group
              </Text>
            )}
          </PressableScale>
        </ScrollView>
      </KeyboardSafeView>

      <LanguageCatalogModal
        visible={pickerOpen}
        languages={catalog.data ?? []}
        selectedIds={selectedIds}
        disableSelected={false}
        title="Language practiced"
        onSelect={(next) => {
          setLanguage(next);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  field: { gap: 8 },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 50,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  hint: { fontSize: 12, fontWeight: "500" },
  picker: { justifyContent: "center" },
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerText: { fontSize: 15, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { fontWeight: "600" },
  submit: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { fontSize: 16, fontWeight: "700" },
});
