import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Share, StyleSheet, View } from "react-native";

import { useLanguages } from "@/features/languages";
import { languageFlag } from "@/features/languages/utils";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { ActionSheet } from "@/shared/components/ActionSheet";
import { Chip } from "@/shared/components/Chip";
import { Screen } from "@/shared/components/Screen";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { Skeleton } from "@/shared/components/Skeleton";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import type { Expression, SavedPhrase } from "../api/collectionsApi";
import { PhraseCard } from "../components/PhraseCard";
import {
  useExpressions,
  useRemovePhrase,
  useSavedPhrases,
  useSaveExpression,
} from "../hooks/useCollection";
import { useSpeech } from "../hooks/useSpeech";

type Tab = "saved" | "discover";
const TABS = [
  { id: "saved", label: "My collection" },
  { id: "discover", label: "Discover" },
] as const;

function CardsSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} height={118} radius={radius.lg} />
      ))}
    </View>
  );
}

function MenuButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="ellipsis-vertical" size={20} color={colors.muted} />
    </Pressable>
  );
}

/** Your saved phrases and idioms, plus curated expressions to add. */
export function CollectionScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>("saved");
  const [menuPhrase, setMenuPhrase] = useState<SavedPhrase | null>(null);
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const speech = useSpeech();

  const phrasesQuery = useSavedPhrases();
  const expressionsQuery = useExpressions(language);
  const catalogQuery = useLanguages();
  const removePhrase = useRemovePhrase();
  const saveExpression = useSaveExpression();

  const phrases = phrasesQuery.data?.items ?? [];
  const languageName = useMemo(() => {
    const byCode = new Map(
      (catalogQuery.data ?? []).map((item) => [item.code, `${languageFlag(item)} ${item.name}`]),
    );
    return (code: string) => byCode.get(code) ?? code.toUpperCase();
  }, [catalogQuery.data]);

  const share = async (phrase: SavedPhrase) => {
    const lines = [phrase.sourceText, phrase.correctedText, phrase.note, phrase.example]
      .filter(Boolean)
      .join("\n");
    await Share.share({ message: lines }).catch(() => undefined);
  };

  const remove = (phrase: SavedPhrase) =>
    removePhrase.mutate(phrase, {
      onError: () => Alert.alert("Could not remove", "Please try again."),
    });

  const renderSaved = ({ item }: { item: SavedPhrase }) => (
    <PhraseCard
      phrase={item.sourceText}
      corrected={item.correctedText}
      meaning={item.note}
      example={item.example}
      speaking={speech.speakingId === item.id}
      onSpeak={() => speech.toggle(item.id, item.sourceText, item.languageCode)}
      action={
        <MenuButton label={`Options for ${item.sourceText}`} onPress={() => setMenuPhrase(item)} />
      }
    />
  );

  const renderExpression = ({ item }: { item: Expression }) => {
    const saved = item.savedPhraseId !== null;
    return (
      <PhraseCard
        phrase={item.phrase}
        meaning={item.meaning}
        example={item.example}
        speaking={speech.speakingId === item.id}
        onSpeak={() => speech.toggle(item.id, item.phrase, item.languageCode)}
        action={
          <Pressable
            onPress={() =>
              saved
                ? setTab("saved")
                : saveExpression.mutate(item.id, {
                    onError: () => Alert.alert("Could not save", "Please try again."),
                  })
            }
            hitSlop={10}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={
              saved ? `${item.phrase} is in your collection` : `Save ${item.phrase}`
            }
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={colors.accent}
            />
          </Pressable>
        }
      />
    );
  };

  const savedTab = phrasesQuery.isPending ? (
    <CardsSkeleton />
  ) : phrasesQuery.isError ? (
    <WarmErrorState
      title="Could not load your collection"
      body="Check your connection and try again."
      onAction={() => void phrasesQuery.refetch()}
    />
  ) : (
    <FlatList
      data={phrases}
      keyExtractor={(item) => item.id}
      renderItem={renderSaved}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <AppRefreshControl
          refreshing={phrasesQuery.isRefetching}
          onRefresh={() => void phrasesQuery.refetch()}
        />
      }
      ListEmptyComponent={
        <WarmEmptyState
          title="Your collection is empty"
          body="Save lines from your chats, or add expressions from Discover."
          action={
            <Chip
              label="Discover expressions"
              icon="sparkles-outline"
              onPress={() => setTab("discover")}
            />
          }
        />
      }
    />
  );

  const expressions = expressionsQuery.data;
  const discoverTab = (
    <>
      {expressions && expressions.languages.length > 0 ? (
        <View style={styles.languages}>
          <Chip
            label="I'm learning"
            selected={language === undefined}
            onPress={() => setLanguage(undefined)}
          />
          {expressions.languages.map((code) => (
            <Chip
              key={code}
              label={languageName(code)}
              selected={language === code}
              onPress={() => setLanguage(code)}
            />
          ))}
        </View>
      ) : null}
      {expressionsQuery.isPending ? (
        <CardsSkeleton />
      ) : expressionsQuery.isError || !expressions ? (
        <WarmErrorState
          title="Could not load expressions"
          body="Check your connection and try again."
          onAction={() => void expressionsQuery.refetch()}
        />
      ) : (
        <FlatList
          data={expressions.items}
          keyExtractor={(item) => item.id}
          renderItem={renderExpression}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <WarmEmptyState
              title="No expressions for this language yet"
              body="Pick one of the languages above to explore its idioms."
            />
          }
        />
      )}
    </>
  );

  return (
    <Screen includeBottomInset>
      <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      <View style={styles.body}>{tab === "saved" ? savedTab : discoverTab}</View>

      <ActionSheet
        visible={menuPhrase !== null}
        onClose={() => setMenuPhrase(null)}
        title={menuPhrase?.sourceText}
        actions={[
          {
            label: "Listen",
            icon: "volume-high-outline",
            onPress: () => {
              const phrase = menuPhrase;
              setMenuPhrase(null);
              if (phrase) speech.toggle(phrase.id, phrase.sourceText, phrase.languageCode);
            },
          },
          {
            label: "Share",
            icon: "share-outline",
            onPress: () => {
              const phrase = menuPhrase;
              setMenuPhrase(null);
              if (phrase) void share(phrase);
            },
          },
          {
            label: "Remove from collection",
            icon: "trash-outline",
            tone: "danger",
            onPress: () => {
              const phrase = menuPhrase;
              setMenuPhrase(null);
              if (phrase) remove(phrase);
            },
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    marginTop: spacing.md,
  },
  list: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  languages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
