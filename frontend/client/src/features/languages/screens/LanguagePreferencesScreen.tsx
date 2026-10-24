import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/shared/components/Button";
import { Screen } from "@/shared/components/Screen";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { LanguageAppSettings } from "../components/LanguageAppSettings";
import { LanguageSetupSections } from "../components/LanguageSetupSections";
import { LanguageSnackbar } from "../components/LanguageSnackbar";
import { LanguagesSkeleton } from "../components/LanguagesSkeleton";
import { useManageUserLanguages } from "../hooks/useLanguages";
import type { UserLanguageItem, UserLanguageSelection } from "../types";
import { toSyncPayload } from "../utils";

const SYNC_DEBOUNCE_MS = 450;

function toSelections(items: UserLanguageItem[]): UserLanguageSelection[] {
  return items.map((item) => ({
    languageId: item.languageId,
    proficiency: item.proficiency,
  }));
}

export function LanguagePreferencesScreen() {
  const colors = useColors();
  const manager = useManageUserLanguages();
  const [snack, setSnack] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [spokenLanguages, setSpokenLanguages] = useState<UserLanguageSelection[]>([]);
  const [learningLanguages, setLearningLanguages] = useState<UserLanguageSelection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokenRef = useRef(spokenLanguages);
  const learningRef = useRef(learningLanguages);
  const syncGeneration = useRef(0);

  spokenRef.current = spokenLanguages;
  learningRef.current = learningLanguages;

  const dismissSnack = useCallback(() => {
    setSnack(null);
    manager.resetError();
  }, [manager.resetError]);

  useEffect(() => {
    if (manager.errorMessage) {
      setSnack({ message: manager.errorMessage, tone: "error" });
    }
  }, [manager.lastError, manager.errorMessage]);

  // Hydrate / re-sync drafts from server when not waiting on a debounced save.
  useEffect(() => {
    if (manager.mineQuery.isLoading) {
      return;
    }
    if (debounceTimer.current) {
      return;
    }
    setSpokenLanguages(toSelections(manager.grouped.SPEAKS));
    setLearningLanguages(toSelections(manager.grouped.LEARNING));
    setHydrated(true);
  }, [manager.grouped.SPEAKS, manager.grouped.LEARNING, manager.mineQuery.isLoading]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const showMessage = (message: string | null, tone: "error" | "success" = "error") => {
    if (!message) {
      return;
    }
    setSnack({ message, tone });
  };

  const scheduleSync = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const generation = ++syncGeneration.current;

    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      const spoken = spokenRef.current;
      const learning = learningRef.current;
      manager.sync.mutate(
        toSyncPayload({
          SPEAKS: mapToItems(spoken, manager.grouped.SPEAKS, "SPEAKS"),
          LEARNING: mapToItems(learning, manager.grouped.LEARNING, "LEARNING"),
        }),
        {
          onError: () => {
            if (generation !== syncGeneration.current) return;
            showMessage("Could not save languages. Try again.");
            setSpokenLanguages(toSelections(manager.grouped.SPEAKS));
            setLearningLanguages(toSelections(manager.grouped.LEARNING));
          },
        },
      );
    }, SYNC_DEBOUNCE_MS);
  };

  const handleSpokenChange = (next: UserLanguageSelection[]) => {
    setSpokenLanguages(next);
    scheduleSync();
  };

  const handleLearningChange = (next: UserLanguageSelection[]) => {
    setLearningLanguages(next);
    scheduleSync();
  };

  const isLoading = manager.catalogQuery.isLoading || manager.mineQuery.isLoading || !hydrated;
  const isError = manager.catalogQuery.isError || manager.mineQuery.isError;

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text }]}>Languages</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Tell partners what you speak and what you want to practice.
      </Text>

      {isLoading ? (
        <LanguagesSkeleton />
      ) : isError ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: colors.rose }]}>Could not load languages.</Text>
          <Button label="Try again" onPress={() => manager.refetch()} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LanguageSetupSections
            languages={manager.catalog}
            spokenLanguages={spokenLanguages}
            learningLanguages={learningLanguages}
            onSpokenChange={handleSpokenChange}
            onLearningChange={handleLearningChange}
            onLimitReached={(message) => showMessage(message)}
          />
          <LanguageAppSettings catalog={manager.catalog} />
        </ScrollView>
      )}

      <LanguageSnackbar
        message={snack?.message ?? null}
        tone={snack?.tone}
        onDismiss={dismissSnack}
      />
    </Screen>
  );
}

function mapToItems(
  selections: Array<{ languageId: string; proficiency: UserLanguageItem["proficiency"] }>,
  existing: UserLanguageItem[],
  type: UserLanguageItem["type"],
): UserLanguageItem[] {
  return selections.map((item) => {
    const prev = existing.find((row) => row.languageId === item.languageId);
    if (prev) {
      return { ...prev, proficiency: item.proficiency };
    }
    return {
      id: `temp-${type}-${item.languageId}`,
      languageId: item.languageId,
      code: item.languageId,
      name: item.languageId,
      flagEmoji: "🏳️",
      type,
      proficiency: item.proficiency,
    };
  });
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    marginBottom: spacing.md,
    fontWeight: "600",
  },
  content: {
    paddingBottom: spacing.xl,
  },
  list: {
    flex: 1,
  },
  errorBox: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  errorText: {
    fontWeight: "700",
  },
});
