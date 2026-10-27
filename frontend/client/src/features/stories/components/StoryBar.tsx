import { Ionicons } from "@expo/vector-icons";
import type { StoryGroupDto } from "@sayly/shared";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePracticeLanguages } from "@/features/icebreakers/hooks";
import { useProfile } from "@/features/profile";
import type { AppStackParamList } from "@/navigation/types";
import { Avatar } from "@/shared/components/Avatar";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { useSeenStories, useStoryFeed } from "../hooks";
import { firstUnseenIndex, hasUnseen, orderGroups, type StoryPosition } from "../model";
import { storyRingGradient } from "../palette";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";

const BUBBLE = 64;
const RING = 3;

type BubbleProps = {
  name: string;
  avatarUrl: string | null | undefined;
  label: string;
  /** Unwatched stories glow; watched ones fade; null = no story at all. */
  ring: "fresh" | "watched" | null;
  onPress: () => void;
  accessibilityLabel: string;
  /** Small "+" in the corner (the viewer's own bubble). */
  onAdd?: () => void;
};

function StoryBubble({
  name,
  avatarUrl,
  label,
  ring,
  onPress,
  accessibilityLabel,
  onAdd,
}: BubbleProps) {
  const colors = useColors();
  const ringColors: readonly [string, string, ...string[]] =
    ring === "fresh"
      ? storyRingGradient
      : ring === "watched"
        ? [colors.trail, colors.trail]
        : [colors.border, colors.border];

  return (
    <View style={styles.bubble}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <LinearGradient
          colors={ringColors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.ring}
        >
          <View style={[styles.ringInner, { backgroundColor: colors.background }]}>
            <Avatar uri={avatarUrl} name={name} size={BUBBLE - RING * 2 - 4} />
          </View>
        </LinearGradient>
      </Pressable>
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          hitSlop={8}
          style={[styles.add, { backgroundColor: colors.primary, borderColor: colors.background }]}
          accessibilityRole="button"
          accessibilityLabel="Add Story"
        >
          <Ionicons name="add" size={16} color={colors.onPrimary} />
        </Pressable>
      ) : null}
      <Text
        style={[styles.label, { color: ring === "watched" ? colors.muted : colors.text }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </View>
  );
}

type ViewerState = { groups: StoryGroupDto[]; start: StoryPosition };

/**
 * Instants carousel under the screen header: "Add Instant" with the viewer's avatar first,
 * then friends and followed members with live stories, unwatched ones first.
 */
export function StoryBar() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const feed = useStoryFeed();
  const profile = useProfile();
  const languages = usePracticeLanguages();
  const { seen, markSeen } = useSeenStories();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const me = profile.data;
  const mine = feed.data?.mine ?? null;
  // Order is fixed on open (see ViewerState) so watching a story does not reshuffle the queue.
  const groups = useMemo(
    () => orderGroups(feed.data?.groups ?? [], seen),
    [feed.data?.groups, seen],
  );

  const openGroups = (queue: StoryGroupDto[], index: number) => {
    const group = queue[index];
    if (!group) return;
    setViewer({ groups: queue, start: { group: index, story: firstUnseenIndex(group, seen) } });
  };

  const closeViewer = useCallback(() => setViewer(null), []);
  const openChat = useCallback(
    (conversationId: string) => navigation.navigate("Conversation", { conversationId }),
    [navigation],
  );

  const myName = me?.displayName ?? "You";
  const myAvatar = me?.avatarUrl ?? me?.profileImageUrl;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
        accessibilityLabel="Instants"
      >
        <StoryBubble
          name={myName}
          avatarUrl={myAvatar}
          label={mine ? "Your Story" : "Add Story"}
          ring={mine ? (hasUnseen(mine, seen) ? "fresh" : "watched") : null}
          onPress={() => (mine ? openGroups([mine], 0) : setComposerOpen(true))}
          onAdd={() => setComposerOpen(true)}
          accessibilityLabel={mine ? "View your Story" : "Add Story"}
        />
        {groups.map((group, index) => (
          <StoryBubble
            key={group.author.id}
            name={group.author.displayName}
            avatarUrl={group.author.avatarUrl}
            label={group.author.displayName.split(" ")[0] || group.author.displayName}
            ring={hasUnseen(group, seen) ? "fresh" : "watched"}
            onPress={() => openGroups(groups, index)}
            accessibilityLabel={`View ${group.author.displayName}'s Instants${
              hasUnseen(group, seen) ? ", new" : ""
            }`}
          />
        ))}
      </ScrollView>

      <StoryViewer
        groups={viewer?.groups ?? []}
        start={viewer?.start ?? null}
        viewerId={me?.id}
        onSeen={markSeen}
        onOpenChat={openChat}
        onClose={closeViewer}
      />
      <StoryComposer
        visible={composerOpen}
        languages={languages}
        onClose={() => setComposerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0, marginTop: spacing.md },
  row: { gap: 14, paddingRight: spacing.md, paddingVertical: 2 },
  bubble: { width: BUBBLE + 8, alignItems: "center" },
  ring: { width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, padding: RING },
  ringInner: {
    flex: 1,
    borderRadius: BUBBLE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    position: "absolute",
    top: BUBBLE - 22,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    width: BUBBLE + 8,
    textAlign: "center",
  },
});
