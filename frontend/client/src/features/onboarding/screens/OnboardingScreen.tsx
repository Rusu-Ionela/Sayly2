import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/AuthProvider";
import { uploadChatFile } from "@/features/chat/api/chatApi";
import { LanguageCatalogModal } from "@/features/languages/components/LanguageCatalogModal";
import { useLanguages } from "@/features/languages/hooks/useLanguages";
import type { Language, UserLanguageSelection } from "@/features/languages/types";
import { languageFlag } from "@/features/languages/utils";
import { isUploadedMediaUrl } from "@/lib/mediaUrl";
import { Button } from "@/shared/components/Button";
import { Screen } from "@/shared/components/Screen";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { BirthdayPickerField } from "../components/BirthdayPickerField";
import { ImagePickerAvatar } from "@/features/profile/components/ImagePickerAvatar";
import { MAX_LEARNING_LANGUAGES, MAX_SPOKEN_LANGUAGES } from "@sayly/shared";

import { CountryPicker } from "../components/CountryPicker";
import {
  useCompleteOnboarding,
  useOnboardingDraft,
  useSaveOnboardingDraft,
} from "../hooks/useOnboarding";
import {
  ANSWER_MAX_LENGTH,
  ANSWER_MIN_LENGTH,
  displayNameFromDraft,
  nextOnboardingStep,
  ONBOARDING_QUESTIONS,
  ONBOARDING_STEPS,
  previousOnboardingStep,
  stepBlockReason,
  type Gender,
  type OnboardingDraft,
  type OnboardingStep,
} from "../model/onboardingFlow";

const FLUENT_LIMIT = 3;

type CatalogTarget = "native" | "fluent" | "learning";

const PROMPT_COPY: Partial<Record<OnboardingStep, { badge: string; title: string }>> = {
  nativePrompt: { badge: "1", title: "What is your native language?" },
  fluentPrompt: { badge: "2", title: "Can you speak any other languages fluently?" },
  learnPrompt: { badge: "3", title: "What do you want to practice?" },
};

const PICK_LABEL: Record<CatalogTarget, string> = {
  native: "I am native in",
  fluent: "I speak fluently",
  learning: "I want to practice",
};

async function resolveAvatarForSubmit(value?: string): Promise<string | undefined> {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }
  if (isUploadedMediaUrl(trimmed) || trimmed.startsWith("/media/")) {
    return trimmed;
  }
  const uploaded = await uploadChatFile(trimmed, "image/jpeg", "avatar.jpg");
  return uploaded.url;
}

const emptyDraft = (): OnboardingDraft => ({
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: null,
  skipFluent: false,
  spokenLanguages: [],
  learningLanguages: [],
  answers: ["", "", ""],
  country: "",
});

export function OnboardingScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const languagesQuery = useLanguages();
  const completeOnboarding = useCompleteOnboarding();
  const onboardingDraftQuery = useOnboardingDraft(Boolean(user));
  const { mutateAsync: persistOnboardingDraft } = useSaveOnboardingDraft();
  const [step, setStep] = useState<OnboardingStep>("profile");
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [avatarUri, setAvatarUri] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [catalog, setCatalog] = useState<CatalogTarget | null>(null);
  const hasHydratedDraft = useRef(false);
  const isCompleting = useRef(false);
  const savingDraft = useRef(false);
  const queuedDraft = useRef<{
    step: OnboardingStep;
    questionIndex: number;
    draft: OnboardingDraft;
  } | null>(null);

  const languageData = languagesQuery.data;
  const languages = useMemo(() => languageData ?? [], [languageData]);
  const languageById = useMemo(
    () => new Map(languages.map((language) => [language.id, language])),
    [languages],
  );
  const saving = completeOnboarding.isPending || uploadingPhoto;
  const answer = draft.answers[questionIndex] ?? "";
  const answerReady =
    answer.trim().length >= ANSWER_MIN_LENGTH && answer.trim().length <= ANSWER_MAX_LENGTH;
  const blocked = step === "questions" ? !answerReady : stepBlockReason(step, draft) !== null;

  useEffect(() => {
    if (hasHydratedDraft.current || !onboardingDraftQuery.isFetched) {
      return;
    }
    const saved = onboardingDraftQuery.data;
    if (saved) {
      setStep(saved.step);
      setQuestionIndex(saved.questionIndex);
      setDraft(saved.draft);
    }
    hasHydratedDraft.current = true;
  }, [onboardingDraftQuery.data, onboardingDraftQuery.isFetched]);

  useEffect(() => {
    if (!hasHydratedDraft.current || isCompleting.current) {
      return;
    }

    const timer = setTimeout(() => {
      queuedDraft.current = { step, questionIndex, draft };
      if (savingDraft.current) {
        return;
      }

      const saveNext = async (): Promise<void> => {
        const next = queuedDraft.current;
        if (!next || isCompleting.current) {
          queuedDraft.current = null;
          return;
        }
        queuedDraft.current = null;
        savingDraft.current = true;
        try {
          await persistOnboardingDraft(next);
        } finally {
          savingDraft.current = false;
        }
        if (queuedDraft.current) {
          await saveNext();
        }
      };

      void saveNext().catch(() => undefined);
    }, 600);

    return () => clearTimeout(timer);
  }, [draft, persistOnboardingDraft, questionIndex, step]);

  const goTo = (next: OnboardingStep | null) => {
    if (next) {
      setStep(next);
    }
  };

  const continueForward = (nextDraft = draft) => {
    goTo(nextOnboardingStep(step, nextDraft));
  };

  const goBack = () => {
    if (step === "questions" && questionIndex > 0) {
      setQuestionIndex((current) => current - 1);
      return;
    }
    goTo(previousOnboardingStep(step, draft));
  };

  const finish = () => {
    void (async () => {
      isCompleting.current = true;
      setUploadingPhoto(true);
      try {
        const profileImageUrl = await resolveAvatarForSubmit(avatarUri);
        completeOnboarding.mutate(
          {
            displayName: displayNameFromDraft(draft),
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            gender: draft.gender ?? undefined,
            dateOfBirth: draft.dateOfBirth,
            country: draft.country.trim(),
            spokenLanguages: draft.spokenLanguages,
            learningLanguages: draft.learningLanguages,
            profileAnswers: draft.answers.map((item) => item.trim()),
            profileImageUrl,
          },
          {
            onError: (error) => {
              Alert.alert(
                "Could not finish setup",
                error instanceof Error ? error.message : "Check your connection and try again.",
              );
            },
          },
        );
      } catch {
        Alert.alert("Could not upload photo", "Try another image, or finish without a photo.");
      } finally {
        isCompleting.current = false;
        setUploadingPhoto(false);
      }
    })();
  };

  const handleContinue = () => {
    if (blocked || saving) {
      return;
    }
    if (step === "questions" && questionIndex < ONBOARDING_QUESTIONS.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }
    if (step === "photo") {
      finish();
      return;
    }
    continueForward();
  };

  const openCatalog = (target: CatalogTarget) => {
    if (languagesQuery.isError) {
      Alert.alert("Could not load languages", "Check your connection and try again.");
      languagesQuery.refetch();
      return;
    }
    setCatalog(target);
  };

  const selectLanguage = (language: Language) => {
    if (catalog === "fluent") {
      const fluents = draft.spokenLanguages.filter((item) => item.proficiency !== "NATIVE");
      if (fluents.length >= FLUENT_LIMIT || draft.spokenLanguages.length >= MAX_SPOKEN_LANGUAGES) {
        Alert.alert("Language limit", `You can add up to ${FLUENT_LIMIT} fluent languages.`);
        return;
      }
    }
    if (catalog === "learning" && draft.learningLanguages.length >= MAX_LEARNING_LANGUAGES) {
      Alert.alert(
        "Language limit",
        `You can add up to ${MAX_LEARNING_LANGUAGES} languages to practice.`,
      );
      return;
    }
    const next = applyLanguage(draft, catalog, language);
    if (next === draft) {
      setCatalog(null);
      return;
    }
    setDraft(next);
    setCatalog(null);
    if (catalog === "native") {
      setStep("nativePick");
    } else if (catalog === "fluent") {
      setStep("fluentPick");
    } else if (catalog === "learning") {
      setStep("learnPick");
    }
  };

  const removeLanguage = (target: CatalogTarget, languageId: string) => {
    setDraft((current) => ({
      ...current,
      spokenLanguages:
        target === "learning"
          ? current.spokenLanguages
          : current.spokenLanguages.filter((item) =>
              target === "native"
                ? !(item.languageId === languageId && item.proficiency === "NATIVE")
                : !(item.languageId === languageId && item.proficiency !== "NATIVE"),
            ),
      learningLanguages:
        target === "learning"
          ? current.learningLanguages.filter((item) => item.languageId !== languageId)
          : current.learningLanguages,
    }));
  };

  const skipFluent = () => {
    const nextDraft: OnboardingDraft = {
      ...draft,
      skipFluent: true,
      spokenLanguages: draft.spokenLanguages.filter((item) => item.proficiency === "NATIVE"),
    };
    setDraft(nextDraft);
    goTo(nextOnboardingStep("fluentPrompt", nextDraft));
  };

  const continueLabel = saving
    ? "Saving..."
    : step === "hello"
      ? "Let's Go"
      : step === "photo"
        ? avatarUri
          ? "Save profile"
          : "Finish without a photo"
        : "Continue";

  const showBottomButton =
    step === "profile" ||
    step === "gender" ||
    step === "nativePick" ||
    step === "fluentPick" ||
    step === "learnPick" ||
    step === "questions" ||
    step === "country" ||
    step === "photo";

  return (
    <Screen includeBottomInset>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          {step === "profile" ? (
            <View style={styles.backButton} />
          ) : (
            <Pressable
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[styles.backButton, { backgroundColor: colors.accentSoft }]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
          )}
          <ProgressBar
            value={(ONBOARDING_STEPS.indexOf(step) + 1) / ONBOARDING_STEPS.length}
            track={colors.accentSoft}
          />
        </View>

        <Animated.View
          key={`${step}-${questionIndex}`}
          entering={FadeInRight.duration(280)}
          style={styles.flex}
        >
          {step === "profile" ? (
            <ProfileStep
              draft={draft}
              email={user?.email ?? ""}
              onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            />
          ) : null}
          {step === "gender" ? (
            <GenderStep
              value={draft.gender}
              onChange={(gender) => setDraft((current) => ({ ...current, gender }))}
            />
          ) : null}
          {step === "hello" ? (
            <HelloStep firstName={draft.firstName.trim()} onContinue={handleContinue} />
          ) : null}
          {step === "nativePrompt" || step === "fluentPrompt" || step === "learnPrompt" ? (
            <PromptStep
              badge={PROMPT_COPY[step]?.badge ?? ""}
              title={PROMPT_COPY[step]?.title ?? ""}
              onSelect={() => {
                const target: CatalogTarget =
                  step === "nativePrompt"
                    ? "native"
                    : step === "fluentPrompt"
                      ? "fluent"
                      : "learning";
                setStep(
                  step === "nativePrompt"
                    ? "nativePick"
                    : step === "fluentPrompt"
                      ? "fluentPick"
                      : "learnPick",
                );
                openCatalog(target);
              }}
              onSkip={step === "fluentPrompt" ? skipFluent : undefined}
            />
          ) : null}
          {step === "nativePick" || step === "fluentPick" || step === "learnPick" ? (
            <LanguagePickStep
              target={
                step === "nativePick" ? "native" : step === "fluentPick" ? "fluent" : "learning"
              }
              draft={draft}
              languageById={languageById}
              onAdd={() =>
                openCatalog(
                  step === "nativePick" ? "native" : step === "fluentPick" ? "fluent" : "learning",
                )
              }
              onRemove={(languageId) =>
                removeLanguage(
                  step === "nativePick" ? "native" : step === "fluentPick" ? "fluent" : "learning",
                  languageId,
                )
              }
            />
          ) : null}
          {step === "questions" ? (
            <QuestionStep
              index={questionIndex}
              value={answer}
              onChange={(value) =>
                setDraft((current) => {
                  const answers = [...current.answers] as OnboardingDraft["answers"];
                  answers[questionIndex] = value;
                  return { ...current, answers };
                })
              }
            />
          ) : null}
          {step === "country" ? (
            <TitledStep
              title="Where are you?"
              subtitle="We save a city-level map point from your country, not a street address."
            >
              <CountryPicker
                value={draft.country}
                onChange={(country) => setDraft((current) => ({ ...current, country }))}
              />
            </TitledStep>
          ) : null}
          {step === "photo" ? (
            <TitledStep
              title="Add a photo"
              subtitle="Optional. A face photo helps partners recognize you. You can add one later."
            >
              <ImagePickerAvatar uri={avatarUri || undefined} onChange={setAvatarUri} />
            </TitledStep>
          ) : null}
        </Animated.View>

        {showBottomButton ? (
          <View style={styles.footer}>
            <Button label={continueLabel} onPress={handleContinue} disabled={blocked || saving} />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <LanguageCatalogModal
        visible={catalog !== null}
        languages={languages}
        selectedIds={catalog ? selectedIdsFor(catalog, draft) : new Set()}
        title={catalog ? PICK_LABEL[catalog] : "Languages"}
        disableSelected={catalog !== "native"}
        onSelect={selectLanguage}
        onClose={() => setCatalog(null)}
      />
      {languagesQuery.isLoading && catalog ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </Screen>
  );
}

function applyLanguage(
  draft: OnboardingDraft,
  target: CatalogTarget | null,
  language: Language,
): OnboardingDraft {
  if (!target) {
    return draft;
  }
  if (target === "native") {
    const spoken = [
      { languageId: language.id, proficiency: "NATIVE" as const },
      ...draft.spokenLanguages.filter(
        (item) => item.proficiency !== "NATIVE" && item.languageId !== language.id,
      ),
    ];
    return {
      ...draft,
      spokenLanguages: spoken.slice(0, MAX_SPOKEN_LANGUAGES),
      learningLanguages: draft.learningLanguages.filter((item) => item.languageId !== language.id),
    };
  }
  if (target === "fluent") {
    const fluents = draft.spokenLanguages.filter((item) => item.proficiency !== "NATIVE");
    if (fluents.some((item) => item.languageId === language.id)) {
      return draft;
    }
    if (fluents.length >= FLUENT_LIMIT || draft.spokenLanguages.length >= MAX_SPOKEN_LANGUAGES) {
      return draft;
    }
    return {
      ...draft,
      skipFluent: false,
      spokenLanguages: [
        ...draft.spokenLanguages,
        { languageId: language.id, proficiency: "FLUENT" },
      ],
      learningLanguages: draft.learningLanguages.filter((item) => item.languageId !== language.id),
    };
  }
  if (draft.learningLanguages.some((item) => item.languageId === language.id)) {
    return draft;
  }
  if (draft.learningLanguages.length >= MAX_LEARNING_LANGUAGES) {
    return draft;
  }
  return {
    ...draft,
    learningLanguages: [
      ...draft.learningLanguages,
      { languageId: language.id, proficiency: "BEGINNER" },
    ],
  };
}

function selectedIdsFor(target: CatalogTarget, draft: OnboardingDraft): Set<string> {
  if (target === "native") {
    return new Set(
      draft.spokenLanguages
        .filter((item) => item.proficiency === "NATIVE")
        .map((item) => item.languageId),
    );
  }
  const spoken = draft.spokenLanguages.map((item) => item.languageId);
  const learning = draft.learningLanguages.map((item) => item.languageId);
  return new Set([...spoken, ...learning]);
}

function ProfileStep({
  draft,
  email,
  onChange,
}: {
  draft: OnboardingDraft;
  email: string;
  onChange: (patch: Partial<OnboardingDraft>) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.profile}>
      <IconBadge name="person" />
      <Text style={[styles.screenTitle, { color: colors.text }]}>Your profile</Text>
      <Text style={[styles.screenSubtitle, { color: colors.muted }]}>
        Everyone uses their real name on Sayly. What’s yours?
      </Text>
      <TextInput
        value={draft.firstName}
        onChangeText={(firstName) => onChange({ firstName })}
        placeholder="First name"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="words"
        autoComplete="given-name"
        style={[
          styles.lineInput,
          { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        accessibilityLabel="First name"
      />
      <TextInput
        value={draft.lastName}
        onChangeText={(lastName) => onChange({ lastName })}
        placeholder="Last name"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="words"
        autoComplete="family-name"
        style={[
          styles.lineInput,
          { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        accessibilityLabel="Last name"
      />
      <BirthdayPickerField
        value={draft.dateOfBirth}
        onChange={(dateOfBirth) => onChange({ dateOfBirth })}
      />
      {email ? (
        <View style={[styles.emailBlock, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.emailValue, { color: colors.text }]}>{email}</Text>
          <Text style={[styles.emailNote, { color: colors.muted }]}>
            * not visible to other Sayly members
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function GenderStep({
  value,
  onChange,
}: {
  value: Gender | null;
  onChange: (gender: Gender) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.genderWrap}>
      <IconBadge name="happy" />
      <Text style={[styles.screenTitle, { color: colors.text, textAlign: "center" }]}>
        Your profile
      </Text>
      <Text style={[styles.screenSubtitle, { color: colors.muted, textAlign: "center" }]}>
        What is your gender?
      </Text>
      <GenderOption
        label="Male"
        icon="male"
        selected={value === "MALE"}
        onPress={() => onChange("MALE")}
      />
      <GenderOption
        label="Female"
        icon="female"
        selected={value === "FEMALE"}
        onPress={() => onChange("FEMALE")}
      />
    </View>
  );
}

function GenderOption({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: "male" | "female";
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.genderOption,
        {
          backgroundColor: selected ? colors.accentSoft : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Ionicons name={icon} size={22} color={selected ? colors.primary : colors.muted} />
      <Text style={[styles.genderLabel, { color: colors.text }]}>{label}</Text>
      {selected ? (
        <Animated.View entering={FadeIn.duration(150)}>
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        </Animated.View>
      ) : (
        <View style={styles.checkSpacer} />
      )}
    </Pressable>
  );
}

function HelloStep({ firstName, onContinue }: { firstName: string; onContinue: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.centered}>
      <IconBadge name="hand-right" size={84} />
      <Text style={[styles.helloTitle, { color: colors.text }]}>
        Nice to meet you,{"\n"}
        {firstName || "there"}!
      </Text>
      <Text style={[styles.helloBody, { color: colors.muted }]}>
        You must be excited to start practicing with someone on Sayly.
      </Text>
      <Text style={[styles.helloBody, { color: colors.muted }]}>
        We have a few questions to help you find the right people in our community of language
        learners.
      </Text>
      <View style={styles.centeredButton}>
        <Button label="Let's Go" onPress={onContinue} />
      </View>
    </View>
  );
}

function PromptStep({
  badge,
  title,
  onSelect,
  onSkip,
}: {
  badge: string;
  title: string;
  onSelect: () => void;
  onSkip?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.centered}>
      <LinearGradient
        colors={[colors.mint, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <Text style={styles.badgeText}>{badge}</Text>
      </LinearGradient>
      <Text style={[styles.promptTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.centeredButton}>
        <Button label="Select language" onPress={onSelect} />
      </View>
      {onSkip ? (
        <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip}>
          <Text style={[styles.skipLabel, { color: colors.text }]}>Skip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LanguagePickStep({
  target,
  draft,
  languageById,
  onAdd,
  onRemove,
}: {
  target: CatalogTarget;
  draft: OnboardingDraft;
  languageById: Map<string, Language>;
  onAdd: () => void;
  onRemove: (languageId: string) => void;
}) {
  const colors = useColors();
  const selections = selectionsFor(target, draft);
  return (
    <View style={styles.pick}>
      <Text style={[styles.pickLabel, { color: colors.text }]}>{PICK_LABEL[target]}</Text>
      <View style={styles.chips}>
        {selections.map((item) => {
          const language = languageById.get(item.languageId);
          const name = language?.name ?? "Language";
          return (
            <View
              key={item.languageId}
              style={[
                styles.chip,
                { borderColor: colors.cardBorder, backgroundColor: colors.accentSoft },
              ]}
            >
              <Text style={styles.flag}>{language ? languageFlag(language) : "🏳️"}</Text>
              <Text style={[styles.chipName, { color: colors.text }]}>{name}</Text>
              <Pressable
                onPress={() => onRemove(item.languageId)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${name}`}
              >
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          );
        })}
      </View>
      <Pressable onPress={onAdd} accessibilityRole="button" style={styles.addLanguage}>
        <Text style={[styles.addLanguageLabel, { color: colors.primary }]}>
          {selections.length === 0 ? "Select language" : "Add another"}
        </Text>
      </Pressable>
    </View>
  );
}

function selectionsFor(target: CatalogTarget, draft: OnboardingDraft): UserLanguageSelection[] {
  if (target === "learning") {
    return draft.learningLanguages;
  }
  if (target === "native") {
    return draft.spokenLanguages.filter((item) => item.proficiency === "NATIVE");
  }
  return draft.spokenLanguages.filter((item) => item.proficiency !== "NATIVE");
}

function QuestionStep({
  index,
  value,
  onChange,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = useColors();
  const length = value.trim().length;
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.question}>
      <Text style={[styles.questionCount, { color: colors.primary }]}>
        {index + 1} of {ONBOARDING_QUESTIONS.length}
      </Text>
      <Text style={[styles.promptTitle, { color: colors.text, textAlign: "left" }]}>
        {ONBOARDING_QUESTIONS[index]}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Write a short answer"
        placeholderTextColor={colors.placeholder}
        multiline
        maxLength={ANSWER_MAX_LENGTH}
        style={[
          styles.answerInput,
          { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        accessibilityLabel={ONBOARDING_QUESTIONS[index]}
      />
      <Text
        style={[
          styles.answerMeta,
          { color: length >= ANSWER_MIN_LENGTH ? colors.muted : colors.placeholder },
        ]}
      >
        {length} / {ANSWER_MAX_LENGTH}
        {length < ANSWER_MIN_LENGTH ? ` · at least ${ANSWER_MIN_LENGTH} characters` : ""}
      </Text>
    </ScrollView>
  );
}

function TitledStep({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <ScrollView contentContainerStyle={styles.profile} keyboardShouldPersistTaps="handled">
      <Text style={[styles.screenTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.helloBody, { color: colors.muted, textAlign: "left" }]}>{subtitle}</Text>
      {children}
    </ScrollView>
  );
}

function ProgressBar({ value, track }: { value: number; track: string }) {
  const colors = useColors();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(value, { duration: 400 });
  }, [value, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={[styles.progressTrack, { backgroundColor: track }]}>
      <Animated.View style={[styles.progressFill, fill]}>
        <LinearGradient
          colors={[colors.mint, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function IconBadge({ name, size = 64 }: { name: keyof typeof Ionicons.glyphMap; size?: number }) {
  const colors = useColors();
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9 });
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[styles.iconBadgeWrap, style]}>
      <LinearGradient
        colors={[colors.mint, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.34,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={name} size={size * 0.5} color={colors.onPrimary} />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    height: 44,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    overflow: "hidden",
  },
  iconBadgeWrap: {
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  checkSpacer: {
    width: 22,
  },
  flex: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingTop: spacing.md,
  },
  profile: {
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  screenSubtitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  lineInput: {
    minHeight: 56,
    fontSize: 17,
    fontWeight: "500",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emailBlock: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emailValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  emailNote: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "right",
  },
  genderWrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
    paddingBottom: 80,
  },
  genderOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  genderLabel: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: 48,
  },
  helloTitle: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  helloBody: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  centeredButton: {
    alignSelf: "stretch",
    marginTop: spacing.md,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  badgeText: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  promptTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  skip: {
    marginTop: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  skipLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  pick: {
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  pickLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 12,
  },
  flag: {
    fontSize: 18,
  },
  chipName: {
    fontSize: 16,
    fontWeight: "600",
  },
  addLanguage: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  addLanguageLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  question: {
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  questionCount: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  answerInput: {
    minHeight: 140,
    fontSize: 17,
    lineHeight: 25,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: "top",
  },
  answerMeta: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
