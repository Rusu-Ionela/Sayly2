import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionSheet } from "@/shared/components/ActionSheet";
import { Button } from "@/shared/components/Button";
import { Screen } from "@/shared/components/Screen";
import { Skeleton } from "@/shared/components/Skeleton";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import type { ConversationTopic } from "../api/topicsApi";
import { CreateTopicSheet } from "../components/CreateTopicSheet";
import { useTopicMutations, useTopics } from "../hooks/useTopics";
import { topicErrorMessage } from "../model/topicRules";

function TopicsSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton height={132} radius={radius.xl} />
      <Skeleton width="60%" height={14} />
      <Skeleton height={56} radius={radius.lg} />
      <Skeleton height={56} radius={radius.lg} />
    </View>
  );
}

/**
 * Conversation topics: the main topic as a hero card, the others below. Tap a topic for
 * options; long press deletes it (with confirmation).
 */
export function TopicsScreen() {
  const colors = useColors();
  const topicsQuery = useTopics();
  const { create, remove, makeMain } = useTopicMutations();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuTopic, setMenuTopic] = useState<ConversationTopic | null>(null);

  if (topicsQuery.isPending) {
    return (
      <Screen includeBottomInset>
        <TopicsSkeleton />
      </Screen>
    );
  }

  if (!topicsQuery.data) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="Could not load your topics"
          body="Check your connection and try again."
          onAction={() => void topicsQuery.refetch()}
        />
      </Screen>
    );
  }

  const { items, max } = topicsQuery.data;
  const main = items.find((item) => item.isMain) ?? null;
  const others = items.filter((item) => !item.isMain);
  const full = items.length >= max;

  const confirmDelete = (topic: ConversationTopic) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Alert.alert(
      "Delete topic",
      topic.isMain && others.length > 0
        ? `Delete "${topic.title}"? Your newest topic becomes the main one.`
        : `Delete "${topic.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            remove.mutate(topic.id, {
              onError: (error) => Alert.alert("Could not delete", topicErrorMessage(error)),
            }),
        },
      ],
    );
  };

  const openCreate = () => {
    if (full) {
      Alert.alert("Topic limit reached", `You can have up to ${max} topics. Delete one first.`);
      return;
    }
    create.reset();
    setSheetOpen(true);
  };

  const submit = (input: { title: string; isMain: boolean }) =>
    create.mutate(input, { onSuccess: () => setSheetOpen(false) });

  return (
    <Screen includeBottomInset>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.muted }]}>MAIN TOPIC</Text>
        {main ? (
          <Pressable
            onPress={() => setMenuTopic(main)}
            onLongPress={() => confirmDelete(main)}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={`Main topic: ${main.title}`}
            accessibilityHint="Long press to delete"
          >
            <LinearGradient
              colors={[colors.accent, "#7C6CF8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <Ionicons name="chatbubbles" size={26} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroTitle}>{main.title}</Text>
              <Text style={styles.heroCaption}>Shown on your profile</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View
            style={[
              styles.emptyHero,
              { borderColor: colors.accent, backgroundColor: colors.accentSoft },
            ]}
          >
            <Ionicons name="chatbubbles-outline" size={28} color={colors.accent} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No topics yet</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Topics give partners an easy way to start a conversation with you.
            </Text>
          </View>
        )}

        {items.length > 0 ? (
          <View style={styles.hintRow} accessibilityRole="text">
            <Ionicons name="finger-print-outline" size={16} color={colors.muted} />
            <Text style={[styles.hint, { color: colors.muted }]}>LONG PRESS TO DELETE A TOPIC</Text>
          </View>
        ) : null}

        {others.length > 0 ? (
          <View style={styles.list}>
            {others.map((topic) => (
              <Pressable
                key={topic.id}
                onPress={() => setMenuTopic(topic)}
                onLongPress={() => confirmDelete(topic)}
                delayLongPress={400}
                style={({ pressed }) => [
                  styles.topic,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={topic.title}
                accessibilityHint="Tap for options, long press to delete"
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.accent} />
                <Text style={[styles.topicTitle, { color: colors.text }]}>{topic.title}</Text>
                <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={[styles.count, { color: colors.muted }]}>
          {items.length}/{max} topics
        </Text>
      </ScrollView>

      <Button label="Create a topic" onPress={openCreate} disabled={full} />

      <CreateTopicSheet
        visible={sheetOpen}
        existingTitles={items.map((item) => item.title)}
        isFirst={items.length === 0}
        saving={create.isPending}
        serverError={create.error ? topicErrorMessage(create.error) : null}
        onSubmit={submit}
        onClose={() => setSheetOpen(false)}
      />

      <ActionSheet
        visible={menuTopic !== null}
        onClose={() => setMenuTopic(null)}
        title={menuTopic?.title}
        actions={[
          ...(menuTopic && !menuTopic.isMain
            ? [
                {
                  label: "Make main topic",
                  icon: "star-outline" as const,
                  onPress: () => {
                    const topic = menuTopic;
                    setMenuTopic(null);
                    makeMain.mutate(topic.id, {
                      onError: (error) => Alert.alert("Could not update", topicErrorMessage(error)),
                    });
                  },
                },
              ]
            : []),
          {
            label: "Delete topic",
            icon: "trash-outline",
            tone: "danger",
            onPress: () => {
              const topic = menuTopic;
              setMenuTopic(null);
              if (topic) confirmDelete(topic);
            },
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 132,
    justifyContent: "center",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  heroCaption: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyHero: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: "dashed",
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  hint: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  list: {
    gap: spacing.sm,
  },
  topic: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  topicTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  count: {
    fontSize: 13,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
