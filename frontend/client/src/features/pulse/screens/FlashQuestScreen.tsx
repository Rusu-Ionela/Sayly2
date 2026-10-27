import { Ionicons } from "@expo/vector-icons";
import {
  FLASH_QUEST_DURATION_MS,
  FLASH_QUEST_MESSAGE_MAX,
  type FlashQuestDto,
} from "@sayly/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useProfile } from "@/features/profile";
import { useStreak } from "@/features/streaks/hooks";
import type { AppStackParamList } from "@/navigation/types";
import { Avatar } from "@/shared/components/Avatar";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { spacing } from "@/shared/theme/spacing";

import { PulseHalo } from "../components/PulseHalo";
import { type QuestState, useFlashQuest, useFlashQuestActions } from "../hooks";
import { formatCountdown, questRemainingMs } from "../model";
import { pulsePalette } from "../palette";

type Props = NativeStackScreenProps<AppStackParamList, "FlashQuest">;

/** Ticks while something on screen counts down. */
function useNow(running: boolean, everyMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs, running]);
  return now;
}

/** The status to show: the local timer can end a quest before the next server update. */
function shownStatus(
  state: QuestState | undefined,
  now: number,
): FlashQuestDto["status"] | "STARTING" {
  if (!state) return "STARTING";
  const { quest, offsetMs } = state;
  if (quest.status === "ACTIVE" && questRemainingMs(quest, offsetMs, now) <= 0) return "ENDED";
  if (quest.status === "SEARCHING" && Date.parse(quest.searchExpiresAt) - (now + offsetMs) <= 0) {
    return "CANCELLED";
  }
  return quest.status;
}

export function FlashQuestScreen({ navigation, route }: Props) {
  const { languageId, languageName } = route.params;
  const [questId, setQuestId] = useState<string | null>(null);
  const quest = useFlashQuest(questId);
  const actions = useFlashQuestActions(setQuestId);
  const state = quest.data;
  const live = state?.quest.status === "SEARCHING" || state?.quest.status === "ACTIVE";
  const now = useNow(live);
  const status = shownStatus(state, now);
  const startQuest = actions.start.mutate;

  const begin = useCallback(() => {
    setQuestId(null);
    startQuest(languageId, {
      onError: (error) =>
        Alert.alert(
          "Could not start",
          error instanceof Error ? error.message : "Please try again.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        ),
    });
  }, [languageId, navigation, startQuest]);

  useEffect(() => {
    begin();
    // Start once when the screen opens; "Play again" calls begin() itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A buzz when a partner is found and when time is up.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (lastStatus.current !== status && (status === "ACTIVE" || status === "ENDED")) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      if (status === "ENDED") void quest.refetch();
    }
    lastStatus.current = status;
  }, [quest, status]);

  const close = () => {
    const current = state?.quest;
    if (current && (status === "SEARCHING" || status === "ACTIVE")) {
      actions.leave.mutate(current.id);
    }
    navigation.goBack();
  };

  return (
    <LinearGradient colors={[pulsePalette.deepEdge, pulsePalette.deep]} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>⚡ Flash Quest · {languageName}</Text>
          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close Flash Quest"
          >
            <Ionicons name="close" size={28} color={pulsePalette.text} />
          </Pressable>
        </View>

        {status === "STARTING" || status === "SEARCHING" ? (
          <Searching state={state} now={now} languageName={languageName} onCancel={close} />
        ) : status === "ACTIVE" && state ? (
          <ActiveQuest
            state={state}
            now={now}
            sending={actions.send.isPending}
            onSend={(body) =>
              actions.send.mutate(
                { questId: state.quest.id, body },
                {
                  onError: (error) =>
                    Alert.alert(
                      "Not sent",
                      error instanceof Error ? error.message : "Please try again.",
                    ),
                },
              )
            }
          />
        ) : status === "ENDED" && state ? (
          <QuestEnded
            quest={state.quest}
            connecting={actions.connect.isPending}
            onConnect={() =>
              actions.connect.mutate(state.quest.id, {
                onError: (error) =>
                  Alert.alert(
                    "Could not connect",
                    error instanceof Error ? error.message : "Please try again.",
                  ),
              })
            }
            onAgain={begin}
            onConnections={() => navigation.replace("Connections")}
            onDone={() => navigation.goBack()}
          />
        ) : (
          <QuestCancelled
            partnerLeft={Boolean(state?.quest.startedAt)}
            onAgain={begin}
            onDone={() => navigation.goBack()}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Searching({
  state,
  now,
  languageName,
  onCancel,
}: {
  state: QuestState | undefined;
  now: number;
  languageName: string;
  onCancel: () => void;
}) {
  const profile = useProfile();
  const left = state
    ? Math.max(0, Date.parse(state.quest.searchExpiresAt) - (now + state.offsetMs))
    : null;
  return (
    <View style={styles.center}>
      <View style={styles.searchStage}>
        <PulseHalo size={120} color={pulsePalette.neon} />
        <PulseHalo size={120} color={pulsePalette.glow} delayMs={600} />
        <PulseHalo size={120} color={pulsePalette.online} delayMs={1200} />
        <Avatar
          uri={profile.data?.avatarUrl ?? profile.data?.profileImageUrl}
          name={profile.data?.displayName}
          size={120}
        />
      </View>
      <Text style={styles.title}>Finding a partner…</Text>
      <Text style={styles.subtitle}>
        Someone else practising {languageName} will join you for a 3-minute challenge.
      </Text>
      {left !== null ? <Text style={styles.small}>Searching · {formatCountdown(left)}</Text> : null}
      <Pressable onPress={onCancel} style={styles.ghostButton} accessibilityRole="button">
        <Text style={styles.ghostText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function ActiveQuest({
  state,
  now,
  sending,
  onSend,
}: {
  state: QuestState;
  now: number;
  sending: boolean;
  onSend: (body: string) => void;
}) {
  const { quest, offsetMs } = state;
  const profile = useProfile();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const remaining = questRemainingMs(quest, offsetMs, now);
  const progress = remaining / FLASH_QUEST_DURATION_MS;
  const urgent = remaining < 30_000;
  const myId = profile.data?.id;

  const submit = () => {
    const body = draft.trim();
    if (!body || sending) return;
    onSend(body);
    setDraft("");
  };

  return (
    <KeyboardSafeView>
      <View style={styles.timerRow}>
        <Avatar uri={quest.partner?.avatarUrl} name={quest.partner?.displayName} size={40} />
        <View style={styles.flex}>
          <Text style={styles.partnerName} numberOfLines={1}>
            {quest.partner?.displayName ?? "Your partner"}
          </Text>
          <View style={styles.timerTrack}>
            <View
              style={[
                styles.timerFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: urgent ? pulsePalette.danger : pulsePalette.neon,
                },
              ]}
            />
          </View>
        </View>
        <Text
          style={[styles.timer, urgent && { color: pulsePalette.danger }]}
          accessibilityLabel={`${Math.ceil(remaining / 1000)} seconds left`}
        >
          {formatCountdown(remaining)}
        </Text>
      </View>

      <Animated.View entering={FadeInDown} style={styles.topicCard}>
        <Text style={styles.topicLabel}>TODAY’S QUEST</Text>
        <Text style={styles.topic}>{quest.topic.text}</Text>
        {quest.topic.english !== quest.topic.text ? (
          <Text style={styles.hint}>{quest.topic.english}</Text>
        ) : null}
        <View style={styles.challenge}>
          <Ionicons name="trophy" size={14} color={pulsePalette.neon} />
          <Text style={styles.challengeText}>{quest.topic.challenge}</Text>
        </View>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {quest.messages.length === 0 ? (
          <Text style={styles.small}>Say hi in {quest.languageName} — the clock is running!</Text>
        ) : null}
        {quest.messages.map((message) => {
          const mine = message.senderId === myId;
          return (
            <Animated.View
              key={message.id}
              entering={FadeIn.duration(160)}
              style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
            >
              <Text style={styles.bubbleText}>{message.body}</Text>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Write in ${quest.languageName}…`}
          placeholderTextColor={pulsePalette.muted}
          style={styles.input}
          maxLength={FLASH_QUEST_MESSAGE_MAX}
          onSubmitEditing={submit}
          returnKeyType="send"
          blurOnSubmit={false}
          accessibilityLabel="Message"
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim() || sending}
          style={[styles.send, (!draft.trim() || sending) && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          {sending ? (
            <ActivityIndicator color={pulsePalette.white} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={pulsePalette.white} />
          )}
        </Pressable>
      </View>
    </KeyboardSafeView>
  );
}

function QuestEnded({
  quest,
  connecting,
  onConnect,
  onAgain,
  onConnections,
  onDone,
}: {
  quest: FlashQuestDto;
  connecting: boolean;
  onConnect: () => void;
  onAgain: () => void;
  onConnections: () => void;
  onDone: () => void;
}) {
  const streak = useStreak();
  const partnerName = quest.partner?.displayName ?? "your partner";
  const messageCount = quest.messages.length;

  return (
    <ScrollView contentContainerStyle={styles.center}>
      <Animated.Text entering={FadeInDown} style={styles.bigEmoji}>
        ⏱️
      </Animated.Text>
      <Text style={styles.title}>Time’s up!</Text>
      <Text style={styles.subtitle}>
        {messageCount > 0
          ? `You and ${partnerName} traded ${messageCount} ${messageCount === 1 ? "message" : "messages"} in ${quest.languageName}.`
          : `The quest with ${partnerName} is over.`}
      </Text>

      <Animated.View entering={FadeIn.delay(200)} style={styles.streakCard}>
        <Text style={styles.streakFire}>🔥</Text>
        <View style={styles.flex}>
          <Text style={styles.streakTitle}>
            {streak.data ? `${streak.data.current}-day streak` : "Streak"}
          </Text>
          <Text style={styles.small}>
            {streak.data?.activeToday
              ? "Today counts for your streak."
              : "Send a message in a quest or stay friends to count today."}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.partnerRow}>
        <Avatar uri={quest.partner?.avatarUrl} name={quest.partner?.displayName} size={56} />
        <View style={styles.flex}>
          <Text style={styles.partnerName}>{partnerName}</Text>
          <Text style={styles.small}>
            {quest.connected
              ? "You’re connected now. Keep practising together!"
              : quest.iWantToConnect
                ? `Waiting for ${partnerName} to say yes…`
                : quest.partnerWantsToConnect
                  ? `${partnerName} wants to stay friends!`
                  : "Liked it? Become language partners."}
          </Text>
        </View>
      </View>

      {quest.connected ? (
        <Pressable onPress={onConnections} style={styles.primaryButton} accessibilityRole="button">
          <Text style={styles.primaryText}>🤝 See your connections</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onConnect}
          disabled={quest.iWantToConnect || connecting}
          style={[styles.primaryButton, quest.iWantToConnect && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: quest.iWantToConnect || connecting, busy: connecting }}
        >
          {connecting ? (
            <ActivityIndicator color={pulsePalette.white} />
          ) : (
            <Text style={styles.primaryText}>
              {quest.iWantToConnect ? "Request sent" : "🤝 Stay friends"}
            </Text>
          )}
        </Pressable>
      )}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onAgain}
          style={[styles.ghostButton, styles.flex]}
          accessibilityRole="button"
        >
          <Text style={styles.ghostText}>⚡ Another quest</Text>
        </Pressable>
        <Pressable
          onPress={onDone}
          style={[styles.ghostButton, styles.flex]}
          accessibilityRole="button"
        >
          <Text style={styles.ghostText}>Done</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function QuestCancelled({
  partnerLeft,
  onAgain,
  onDone,
}: {
  partnerLeft: boolean;
  onAgain: () => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.bigEmoji}>{partnerLeft ? "👋" : "🌙"}</Text>
      <Text style={styles.title}>
        {partnerLeft ? "Your partner left" : "Nobody’s around right now"}
      </Text>
      <Text style={styles.subtitle}>
        {partnerLeft
          ? "No worries — jump into another quest."
          : "Try again in a moment, or post a Voice Spark so people can find you."}
      </Text>
      <Pressable onPress={onAgain} style={styles.primaryButton} accessibilityRole="button">
        <Text style={styles.primaryText}>⚡ Try again</Text>
      </Pressable>
      <Pressable onPress={onDone} style={styles.ghostButton} accessibilityRole="button">
        <Text style={styles.ghostText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brand: { color: pulsePalette.neon, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  searchStage: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { color: pulsePalette.text, fontSize: 26, fontWeight: "800", textAlign: "center" },
  subtitle: { color: pulsePalette.muted, fontSize: 16, textAlign: "center", lineHeight: 22 },
  small: { color: pulsePalette.muted, fontSize: 13, fontWeight: "600", textAlign: "center" },
  bigEmoji: { fontSize: 56 },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  partnerName: { color: pulsePalette.text, fontSize: 16, fontWeight: "800" },
  timerTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: pulsePalette.glass,
    marginTop: 6,
    overflow: "hidden",
  },
  timerFill: { height: 6, borderRadius: 3 },
  timer: {
    color: pulsePalette.text,
    fontSize: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    minWidth: 72,
    textAlign: "right",
  },
  topicCard: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: pulsePalette.glass,
    borderWidth: 1,
    borderColor: pulsePalette.ringStrong,
    gap: 6,
  },
  topicLabel: { color: pulsePalette.neon, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  topic: { color: pulsePalette.text, fontSize: 19, fontWeight: "800", lineHeight: 25 },
  hint: { color: pulsePalette.muted, fontSize: 14, fontStyle: "italic" },
  challenge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  challengeText: { flex: 1, color: pulsePalette.neon, fontSize: 13, fontWeight: "700" },
  messages: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 8 },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: pulsePalette.glow,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: pulsePalette.glass,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: pulsePalette.glassBorder,
  },
  bubbleText: { color: pulsePalette.white, fontSize: 16, lineHeight: 21 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: pulsePalette.glassBorder,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 18,
    color: pulsePalette.text,
    backgroundColor: pulsePalette.glass,
    fontSize: 16,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: pulsePalette.glow,
    alignItems: "center",
    justifyContent: "center",
  },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "stretch",
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  streakFire: { fontSize: 32 },
  streakTitle: { color: pulsePalette.text, fontSize: 17, fontWeight: "800" },
  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "stretch",
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: pulsePalette.glass,
  },
  primaryButton: {
    alignSelf: "stretch",
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: pulsePalette.glow,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: pulsePalette.white, fontSize: 17, fontWeight: "800" },
  buttonRow: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" },
  ghostButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: pulsePalette.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: pulsePalette.text, fontSize: 15, fontWeight: "700" },
});
