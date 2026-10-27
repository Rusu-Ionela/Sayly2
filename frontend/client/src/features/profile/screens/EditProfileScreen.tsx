import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { Controller, useForm, useWatch, type FieldPath, type PathValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { LanguageLevelList } from "@/features/onboarding/components/LanguageLevelList";
import { CountryPicker } from "@/features/onboarding/components/CountryPicker";
import { useLanguages } from "@/features/languages";
import type { ProficiencyLevel, UserLanguageSelection } from "@/features/languages/types";
import type { AppStackParamList } from "@/navigation/types";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { CertificateEditor } from "../components/CertificateEditor";
import { CertificateList } from "../components/CertificateList";
import { CityPicker } from "../components/CityPicker";
import { DateOfBirthField } from "../components/DateOfBirthField";
import { ImagePickerAvatar } from "../components/ImagePickerAvatar";
import { PhotoGallery } from "../components/PhotoGallery";
import { ProfileHeader } from "../components/ProfileHeader";
import { ProfileSkeleton } from "../components/ProfileSkeleton";
import { TextField } from "@/shared/components/TextField";
import { confirmAction } from "@/shared/utils/confirmAction";
import {
  MAX_CERTIFICATES,
  MAX_LEARNING_LANGUAGES,
  MAX_SPOKEN_LANGUAGES,
  MAX_TOPICS,
  PRACTICE_GOALS,
  type PracticeGoal,
  type Topic,
  TOPICS,
} from "@sayly/shared";
import { TagList } from "../components/TagList";
import { useProfile, useUpdateProfile } from "../hooks/useProfile";
import { profileAvatarUrl } from "../model/avatar";
import { certificateFormRows, toCertificateFormValues } from "../model/certificates";
import { toLanguageDtos } from "../model/profilePatch";
import { buildProfilePayload } from "../model/profilePayload";
import {
  editProfileSchema,
  type CertificateFormValues,
  type EditProfileFormValues,
} from "../schema";
import type { CurrentUserProfile } from "../types";

type LanguageField = "spokenLanguages" | "learningLanguages";

function toFormValues(profile: CurrentUserProfile | undefined): EditProfileFormValues {
  const toSelection = (item: UserLanguageSelection) => ({
    languageId: item.languageId,
    proficiency: item.proficiency,
  });

  return {
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    country: profile?.country ?? "",
    city: profile?.city ?? "",
    dateOfBirth: profile?.dateOfBirth?.slice(0, 10) ?? "",
    avatarUrl: (profile && profileAvatarUrl(profile)) ?? "",
    practiceGoals: (profile?.practiceGoals ?? []) as EditProfileFormValues["practiceGoals"],
    topics: (profile?.topics ?? []) as EditProfileFormValues["topics"],
    photos: profile?.photos ?? [],
    certificates: toCertificateFormValues(profile?.certificates ?? []),
    spokenLanguages: (profile?.spokenLanguages ?? []).map(toSelection),
    learningLanguages: (profile?.learningLanguages ?? []).map(toSelection),
  };
}

/** Adds the value if missing, removes it if present (goals, topics). */
function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function toggleLanguage(
  list: UserLanguageSelection[],
  languageId: string,
  defaultProficiency: ProficiencyLevel,
): UserLanguageSelection[] {
  return list.some((item) => item.languageId === languageId)
    ? list.filter((item) => item.languageId !== languageId)
    : [...list, { languageId, proficiency: defaultProficiency }];
}

function changeProficiency(
  list: UserLanguageSelection[],
  languageId: string,
  proficiency: ProficiencyLevel,
): UserLanguageSelection[] {
  return list.map((item) => {
    if (item.languageId === languageId) {
      return { ...item, proficiency };
    }
    // Backend allows at most one NATIVE spoken language.
    if (proficiency === "NATIVE" && item.proficiency === "NATIVE") {
      return { ...item, proficiency: "FLUENT" };
    }
    return item;
  });
}

function alertSaveFailed(message: string) {
  Alert.alert("Could not save your profile", message);
}

export function EditProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const profileQuery = useProfile();
  const languagesQuery = useLanguages();
  const { save, saveAsync } = useUpdateProfile({ onError: alertSaveFailed });

  const initialValues = useMemo(() => toFormValues(profileQuery.data), [profileQuery.data]);

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    // A background refetch refreshes untouched fields but never wipes the user's edits.
    values: initialValues,
    resetOptions: { keepDirtyValues: true },
    mode: "onChange",
  });

  const [
    displayName,
    country,
    city,
    avatarUrl,
    practiceGoals,
    topics,
    photos,
    certificates,
    spokenLanguages,
    learningLanguages,
  ] = useWatch({
    control,
    name: [
      "displayName",
      "country",
      "city",
      "avatarUrl",
      "practiceGoals",
      "topics",
      "photos",
      "certificates",
      "spokenLanguages",
      "learningLanguages",
    ],
  });

  const catalog = languagesQuery.data;
  const previewSpoken = useMemo(
    () =>
      toLanguageDtos(
        spokenLanguages ?? [],
        profileQuery.data?.spokenLanguages ?? [],
        catalog ?? [],
      ),
    [catalog, profileQuery.data?.spokenLanguages, spokenLanguages],
  );
  const previewLearning = useMemo(
    () =>
      toLanguageDtos(
        learningLanguages ?? [],
        profileQuery.data?.learningLanguages ?? [],
        catalog ?? [],
      ),
    [catalog, learningLanguages, profileQuery.data?.learningLanguages],
  );
  const certificateLanguages = useMemo(
    () => [...previewSpoken, ...previewLearning],
    [previewLearning, previewSpoken],
  );
  const certificateItems = useMemo(
    () => certificateFormRows(certificates ?? [], catalog ?? []),
    [catalog, certificates],
  );
  const spokenIds = useMemo(
    () => (spokenLanguages ?? []).map((item) => item.languageId),
    [spokenLanguages],
  );
  const learningIds = useMemo(
    () => (learningLanguages ?? []).map((item) => item.languageId),
    [learningLanguages],
  );

  const leaveScreen = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (!isDirty) {
      leaveScreen();
      return;
    }
    confirmAction({
      title: "Discard changes?",
      message: "You have unsaved edits. Leave without saving?",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      onConfirm: () => {
        // Clear dirty state first so navigation is clean.
        reset(initialValues);
        leaveScreen();
      },
    });
  }, [initialValues, isDirty, leaveScreen, reset]);

  // Avoid usePreventRemove / beforeRemove — native-stack desyncs on Discard.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackButtonMenuEnabled: false,
      headerLeft: () => (
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.headerBack}
        >
          <Text style={[styles.headerBackText, { color: colors.accent }]}>‹ Back</Text>
        </Pressable>
      ),
    });
  }, [colors.accent, handleBack, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  /** Stable field setters keep the memoized pickers from re-rendering on every keystroke. */
  const setField = useCallback(
    <K extends FieldPath<EditProfileFormValues>>(
      name: K,
      value: PathValue<EditProfileFormValues, K>,
    ) => {
      setValue(name, value, { shouldDirty: true, shouldValidate: true });
    },
    [setValue],
  );

  const setAvatar = useCallback((value: string) => setField("avatarUrl", value), [setField]);

  const toggleGoal = useCallback(
    (goal: PracticeGoal) => setField("practiceGoals", toggleIn(getValues("practiceGoals"), goal)),
    [getValues, setField],
  );
  const toggleTopic = useCallback(
    (topic: Topic) => setField("topics", toggleIn(getValues("topics"), topic)),
    [getValues, setField],
  );
  const setPhotos = useCallback((next: string[]) => setField("photos", next), [setField]);
  const addCertificate = useCallback(
    (certificate: CertificateFormValues) =>
      setField("certificates", [...getValues("certificates"), certificate]),
    [getValues, setField],
  );
  const removeCertificate = useCallback(
    (key: string) =>
      setField(
        "certificates",
        getValues("certificates").filter((_, index) => String(index) !== key),
      ),
    [getValues, setField],
  );

  const languageHandlers = useCallback(
    (field: LanguageField, defaultProficiency: ProficiencyLevel) => ({
      onToggle: (languageId: string) =>
        setField(field, toggleLanguage(getValues(field), languageId, defaultProficiency)),
      onChangeProficiency: (languageId: string, proficiency: ProficiencyLevel) =>
        setField(field, changeProficiency(getValues(field), languageId, proficiency)),
    }),
    [getValues, setField],
  );
  const spokenHandlers = useMemo(
    () => languageHandlers("spokenLanguages", "NATIVE"),
    [languageHandlers],
  );
  const learningHandlers = useMemo(
    () => languageHandlers("learningLanguages", "BEGINNER"),
    [languageHandlers],
  );

  const onSubmit = useMemo(
    () =>
      handleSubmit(async (values) => {
        const payload = buildProfilePayload(values, initialValues);
        if (payload.avatarUrl) {
          // A new photo is face-checked by the server: wait for the verdict and stay on this
          // screen if it is refused, so the user keeps the rest of their edits.
          try {
            await saveAsync(payload);
          } catch {
            return; // alertSaveFailed already explained why
          }
        } else if (Object.keys(payload).length > 0) {
          // Optimistic: the cache updates now, so the previous screen already shows the edit.
          // On failure the hook rolls back and alertSaveFailed explains why.
          save(payload);
        }
        reset(values);
        leaveScreen();
      }),
    [handleSubmit, initialValues, leaveScreen, reset, save, saveAsync],
  );

  if (profileQuery.isLoading || languagesQuery.isLoading) {
    return (
      <Screen>
        <ProfileSkeleton />
      </Screen>
    );
  }

  const canSave = isDirty && !isSubmitting;

  return (
    <Screen>
      <KeyboardSafeView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.text }]}>Edit profile</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            This is how partners see you on Sayly.
          </Text>

          <ProfileHeader
            displayName={displayName ?? ""}
            country={country ?? ""}
            city={city}
            avatarUrl={avatarUrl}
            spokenLanguages={previewSpoken}
            learningLanguages={previewLearning}
            avatarSlot={
              <ImagePickerAvatar
                uri={avatarUrl || undefined}
                name={displayName}
                output="dataUri"
                onChange={setAvatar}
              />
            }
          />

          <SectionCard title="Basics" variant="content">
            <Controller
              control={control}
              name="displayName"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Display name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.displayName?.message}
                  placeholder="Your name"
                  maxLength={50}
                  autoCapitalize="words"
                />
              )}
            />

            <Text style={[styles.label, { color: colors.text }]}>Country</Text>
            <Controller
              control={control}
              name="country"
              render={({ field: { value, onChange } }) => (
                <CountryPicker
                  value={value}
                  onChange={(next) => {
                    // Cities belong to one country: a new country invalidates the city.
                    if (next !== value) setField("city", "");
                    onChange(next);
                  }}
                />
              )}
            />
            {errors.country ? (
              <Text style={[styles.error, { color: colors.rose }]}>{errors.country.message}</Text>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>City (optional)</Text>
            <Controller
              control={control}
              name="city"
              render={({ field: { value, onChange } }) => (
                <CityPicker country={country ?? ""} value={value} onChange={onChange} />
              )}
            />
            {errors.city ? (
              <Text style={[styles.error, { color: colors.rose }]}>{errors.city.message}</Text>
            ) : null}
            <Controller
              control={control}
              name="dateOfBirth"
              render={({ field: { value, onChange } }) => (
                <DateOfBirthField
                  value={value}
                  onChange={onChange}
                  error={errors.dateOfBirth?.message}
                  hint="Confirms you are 18+. Needed to appear in Discover."
                />
              )}
            />
          </SectionCard>

          <SectionCard title="About me" variant="content">
            <Controller
              control={control}
              name="bio"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label="Bio"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.bio?.message}
                  placeholder="Share what you like to practice…"
                  maxLength={500}
                  showCounter
                  multiline
                />
              )}
            />

            <Text style={[styles.label, { color: colors.text }]}>
              Interests · {(topics ?? []).length}/{MAX_TOPICS}
            </Text>
            <TagList
              options={TOPICS}
              selected={topics ?? []}
              onToggle={toggleTopic}
              max={MAX_TOPICS}
            />
            {errors.topics ? (
              <Text style={[styles.error, { color: colors.rose }]}>{errors.topics.message}</Text>
            ) : null}
            <Text style={[styles.label, { color: colors.text }]}>Learning goals</Text>
            <TagList
              options={PRACTICE_GOALS}
              selected={practiceGoals ?? []}
              onToggle={toggleGoal}
            />
            {errors.practiceGoals ? (
              <Text style={[styles.error, { color: colors.rose }]}>
                {errors.practiceGoals.message}
              </Text>
            ) : null}
          </SectionCard>

          <SectionCard title="Photos" variant="content">
            <PhotoGallery photos={photos ?? []} onChange={setPhotos} />
            {errors.photos ? (
              <Text style={[styles.error, { color: colors.rose }]}>{errors.photos.message}</Text>
            ) : null}
          </SectionCard>

          <SectionCard title="Languages" variant="content">
            <Text style={[styles.section, { color: colors.muted }]}>Spoken languages</Text>
            <LanguageLevelList
              languages={catalog ?? []}
              selected={spokenLanguages ?? []}
              blockedIds={learningIds}
              addLabel="Add a spoken language"
              catalogTitle="Languages you speak"
              maxItems={MAX_SPOKEN_LANGUAGES}
              minItems={1}
              onToggle={spokenHandlers.onToggle}
              onChangeProficiency={spokenHandlers.onChangeProficiency}
            />
            {errors.spokenLanguages ? (
              <Text style={[styles.error, { color: colors.rose }]}>
                {errors.spokenLanguages.message}
              </Text>
            ) : null}

            <Text style={[styles.section, { color: colors.muted }]}>Learning languages</Text>
            <LanguageLevelList
              languages={catalog ?? []}
              selected={learningLanguages ?? []}
              blockedIds={spokenIds}
              addLabel="Add a learning language"
              catalogTitle="Languages you want to learn"
              maxItems={MAX_LEARNING_LANGUAGES}
              minItems={1}
              onToggle={learningHandlers.onToggle}
              onChangeProficiency={learningHandlers.onChangeProficiency}
            />
            {errors.learningLanguages ? (
              <Text style={[styles.error, { color: colors.rose }]}>
                {errors.learningLanguages.message}
              </Text>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Certificates"
            variant="content"
            footer="Self-reported. Shown on your profile so partners know your level."
          >
            <CertificateList items={certificateItems} onRemove={removeCertificate} />
            {(certificates ?? []).length < MAX_CERTIFICATES ? (
              <CertificateEditor languages={certificateLanguages} onAdd={addCertificate} />
            ) : null}
            {errors.certificates ? (
              <Text style={[styles.error, { color: colors.rose }]}>
                {errors.certificates.message}
              </Text>
            ) : null}
          </SectionCard>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View
          style={[
            styles.sticky,
            { backgroundColor: colors.background, borderTopColor: colors.cardBorder },
          ]}
        >
          <Pressable
            style={[
              styles.save,
              { backgroundColor: colors.accent },
              !canSave && styles.saveDisabled,
            ]}
            onPress={() => void onSubmit()}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            accessibilityState={{ disabled: !canSave }}
          >
            {isSubmitting ? (
              <View style={styles.saving}>
                <ActivityIndicator color={colors.onPrimary} />
                <Text style={[styles.saveText, { color: colors.onPrimary }]}>Checking photo…</Text>
              </View>
            ) : (
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save</Text>
            )}
          </Pressable>
        </View>
      </KeyboardSafeView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  headerBack: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBackText: {
    fontSize: 17,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    marginBottom: spacing.md,
    fontWeight: "600",
  },
  label: {
    fontWeight: "700",
  },
  section: {
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  error: {
    fontWeight: "600",
    fontSize: 12,
    marginTop: 4,
  },
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
  },
  save: {
    borderRadius: 14,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  saving: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  saveDisabled: {
    opacity: 0.55,
  },
  saveText: {
    fontWeight: "800",
    fontSize: 16,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
