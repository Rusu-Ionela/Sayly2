import { Ionicons } from "@expo/vector-icons";
import { STORY_REPLY_MAX, type StoryDto, type StoryGroupDto } from "@sayly/shared";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { claimMediaPlayback, releaseMediaPlayback } from "@/features/chat/mediaPlayback";
import { PulseHalo } from "@/features/pulse/components/PulseHalo";
import { ApiError } from "@/lib/api/errors";
import { remoteImageSource, resolveMediaUrl } from "@/lib/mediaUrl";
import { Avatar } from "@/shared/components/Avatar";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { useDeleteStory, useStoryReply } from "../hooks";
import {
  nextPosition,
  pickStable,
  previousPosition,
  storyAgeLabel,
  storyDisplayMs,
  type StoryPosition,
} from "../model";
import { storyPalette, textStoryBackgrounds } from "../palette";

type StoryViewerProps = {
  /** Authors to play in order. The caller freezes this list while the viewer is open. */
  groups: StoryGroupDto[];
  /** Where to start; null keeps the viewer closed. */
  start: StoryPosition | null;
  viewerId: string | undefined;
  onSeen: (storyId: string) => void;
  onOpenChat: (conversationId: string) => void;
  onClose: () => void;
};

/** Full-screen story player: progress on top, tap left/right to step, hold to pause, reply below. */
export function StoryViewer({
  groups,
  start,
  viewerId,
  onSeen,
  onOpenChat,
  onClose,
}: StoryViewerProps) {
  // SafeAreaView reports no insets inside a Modal on iOS.
  const insets = useSafeAreaInsets();
  const [position, setPosition] = useState<StoryPosition>({ group: 0, story: 0 });
  const [holding, setHolding] = useState(false);
  const [typing, setTyping] = useState(false);
  const [ready, setReady] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);

  useEffect(() => {
    if (start) setPosition(start);
    setHolding(false);
    setTyping(false);
  }, [start]);

  const group = groups[position.group];
  const story = group?.stories[position.story];
  const isOwn = Boolean(group && group.author.id === viewerId);
  const paused = holding || typing || !ready;

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValue.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // Each new story starts from zero; text is ready at once, photos and audio once loaded.
  useEffect(() => {
    if (!story) return;
    progress.stopAnimation();
    progress.setValue(0);
    setReady(story.mediaType === "TEXT");
    onSeen(story.id);
  }, [onSeen, progress, story]);

  const markReady = useCallback(() => setReady(true), []);
  const setAudioProgress = useCallback(
    (fraction: number) => progress.setValue(fraction),
    [progress],
  );

  const goNext = useCallback(() => {
    const next = nextPosition(groups, position);
    if (next) setPosition(next);
    else onClose();
  }, [groups, onClose, position]);

  const goPrevious = useCallback(() => {
    const previous = previousPosition(groups, position);
    if (previous.group === position.group && previous.story === position.story) {
      progress.setValue(0);
      return;
    }
    setPosition(previous);
  }, [groups, position, progress]);

  // Photo and text stories run on a timer that pauses and resumes where it stopped.
  const timed = story && story.mediaType !== "VOICE";
  useEffect(() => {
    if (!story || !timed || paused || !start) return;
    const total = storyDisplayMs(story);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(0, total * (1 - progressValue.current)),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => animation.stop();
  }, [goNext, paused, progress, start, story, timed]);

  if (!start || !group || !story) {
    return null;
  }

  const segmentWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.fill, { backgroundColor: storyPalette.backdrop }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.stage}>
            <StoryContent
              key={story.id}
              story={story}
              authorName={group.author.displayName}
              authorAvatar={group.author.avatarUrl}
              paused={paused}
              onReady={markReady}
              onProgress={setAudioProgress}
              onFinished={goNext}
            />

            <View style={styles.tapZones}>
              <Pressable
                style={styles.tapPrevious}
                onPress={goPrevious}
                onLongPress={() => setHolding(true)}
                onPressOut={() => setHolding(false)}
                delayLongPress={180}
                accessibilityRole="button"
                accessibilityLabel="Previous story"
              />
              <Pressable
                style={styles.tapNext}
                onPress={goNext}
                onLongPress={() => setHolding(true)}
                onPressOut={() => setHolding(false)}
                delayLongPress={180}
                accessibilityRole="button"
                accessibilityLabel="Next story"
              />
            </View>

            <LinearGradient
              colors={["rgba(0,0,0,0.55)", "transparent"]}
              style={styles.topShade}
              pointerEvents="none"
            />

            <View style={styles.header} pointerEvents="box-none">
              <View style={styles.progressRow} pointerEvents="none">
                {group.stories.map((item, index) => (
                  <View key={item.id} style={styles.segment}>
                    <Animated.View
                      style={[
                        styles.segmentFill,
                        {
                          width:
                            index < position.story
                              ? "100%"
                              : index === position.story
                                ? segmentWidth
                                : "0%",
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.authorRow} pointerEvents="box-none">
                <Avatar uri={group.author.avatarUrl} name={group.author.displayName} size={36} />
                <View style={styles.authorText} pointerEvents="none">
                  <Text style={styles.authorName} numberOfLines={1}>
                    {isOwn ? "Your Story" : group.author.displayName}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {story.flagEmoji ? `${story.flagEmoji} ` : ""}
                    {story.languageName} · {storyAgeLabel(story.createdAt)}
                  </Text>
                </View>
                {paused && ready ? (
                  <Ionicons name="pause" size={18} color={storyPalette.white} />
                ) : null}
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={26} color={storyPalette.white} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            {isOwn ? (
              <OwnStoryTools story={story} onDeleted={onClose} />
            ) : (
              <ReplyBar
                key={story.id}
                story={story}
                authorName={group.author.displayName}
                onFocusChange={setTyping}
                onOpenChat={(conversationId) => {
                  onClose();
                  onOpenChat(conversationId);
                }}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type StoryContentProps = {
  story: StoryDto;
  authorName: string;
  authorAvatar: string | null;
  paused: boolean;
  onReady: () => void;
  onProgress: (fraction: number) => void;
  onFinished: () => void;
};

function StoryContent({
  story,
  authorName,
  authorAvatar,
  paused,
  onReady,
  onProgress,
  onFinished,
}: StoryContentProps) {
  if (story.mediaType === "PHOTO") {
    return <PhotoStory story={story} onReady={onReady} />;
  }
  if (story.mediaType === "VOICE") {
    return (
      <VoiceStory
        story={story}
        authorName={authorName}
        authorAvatar={authorAvatar}
        paused={paused}
        onReady={onReady}
        onProgress={onProgress}
        onFinished={onFinished}
      />
    );
  }
  return <TextStory story={story} />;
}

function TextStory({ story }: { story: StoryDto }) {
  const text = story.textContent ?? "";
  const size = text.length > 220 ? 20 : text.length > 90 ? 26 : 34;
  return (
    <LinearGradient
      colors={pickStable(story.id, textStoryBackgrounds)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, styles.centered]}
    >
      <Text style={[styles.storyText, { fontSize: size, lineHeight: size * 1.3 }]}>{text}</Text>
    </LinearGradient>
  );
}

function PhotoStory({ story, onReady }: { story: StoryDto; onReady: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={StyleSheet.absoluteFill}>
      {failed ? (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <Ionicons name="image-outline" size={40} color={storyPalette.muted} />
          <Text style={styles.problem}>This photo could not be loaded.</Text>
        </View>
      ) : (
        <Image
          source={remoteImageSource(story.mediaUrl)}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={150}
          onLoad={onReady}
          onError={() => {
            setFailed(true);
            onReady();
          }}
          accessibilityLabel={story.textContent ?? "Photo story"}
        />
      )}
      {story.textContent ? (
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={styles.captionShade}
          pointerEvents="none"
        >
          <Text style={styles.caption}>{story.textContent}</Text>
        </LinearGradient>
      ) : null}
    </View>
  );
}

type VoiceStoryProps = {
  story: StoryDto;
  authorName: string;
  authorAvatar: string | null;
  paused: boolean;
  onReady: () => void;
  onProgress: (fraction: number) => void;
  onFinished: () => void;
};

/** Plays the note as soon as it loads and drives the progress bar from the audio clock. */
function VoiceStory({
  story,
  authorName,
  authorAvatar,
  paused,
  onReady,
  onProgress,
  onFinished,
}: VoiceStoryProps) {
  const playbackId = useId();
  const player = useAudioPlayer(resolveMediaUrl(story.mediaUrl) ?? story.mediaUrl ?? undefined);
  const status = useAudioPlayerStatus(player);
  const finished = useRef(false);
  const [stalled, setStalled] = useState(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Runs before the play effect below, so a finished note is never started again.
  useEffect(() => {
    if ((status.didJustFinish || stalled) && !finished.current) {
      finished.current = true;
      finishTimer.current = setTimeout(() => onFinishedRef.current(), stalled ? 1500 : 400);
    }
  }, [stalled, status.didJustFinish]);

  // An audio file that never loads must not leave the story stuck; skip after 10 s.
  useEffect(() => {
    if (status.isLoaded) {
      onReady();
      return;
    }
    const timer = setTimeout(() => {
      setStalled(true);
      onReady();
    }, 10_000);
    return () => clearTimeout(timer);
  }, [onReady, status.isLoaded]);

  useEffect(() => {
    if (!status.isLoaded) return;
    if (paused) {
      if (status.playing) player.pause();
      return;
    }
    if (!status.playing && !finished.current && !status.didJustFinish) {
      claimMediaPlayback(playbackId, () => {
        try {
          player.pause();
        } catch {
          // the player may already be gone
        }
      });
      player.play();
    }
  }, [paused, playbackId, player, status.didJustFinish, status.isLoaded, status.playing]);

  const durationMs = status.duration > 0 ? status.duration * 1000 : storyDisplayMs(story);
  useEffect(() => {
    if (durationMs > 0) onProgress(Math.min(1, (status.currentTime * 1000) / durationMs));
  }, [durationMs, onProgress, status.currentTime]);

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
      try {
        player.pause();
      } catch {
        // ignore
      }
      releaseMediaPlayback(playbackId);
    },
    [playbackId, player],
  );

  return (
    <LinearGradient
      colors={pickStable(story.id, textStoryBackgrounds)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, styles.centered]}
    >
      <View style={styles.voiceAvatar}>
        <PulseHalo size={140} color={storyPalette.white} active={status.playing} />
        <Avatar uri={authorAvatar} name={authorName} size={140} />
        {!status.isLoaded && !stalled ? (
          <View style={styles.voiceLoading}>
            <ActivityIndicator color={storyPalette.white} />
          </View>
        ) : null}
      </View>
      <View style={styles.voiceLabel}>
        <Ionicons name="mic" size={18} color={storyPalette.white} />
        <Text style={styles.voiceText}>
          {stalled ? "This voice note could not be loaded." : "Voice Instant"}
        </Text>
      </View>
    </LinearGradient>
  );
}

function expiresInLabel(expiresAt: string, now: number = Date.now()): string {
  const hours = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 3_600_000));
  return hours <= 1 ? "Disappears within the hour" : `Disappears in ${hours}h`;
}

function OwnStoryTools({ story, onDeleted }: { story: StoryDto; onDeleted: () => void }) {
  const remove = useDeleteStory();
  const confirm = () =>
    Alert.alert("Delete this Instant?", "It disappears for everyone right away.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove.mutate(story.id, { onSuccess: onDeleted }),
      },
    ]);
  return (
    <View style={styles.ownTools}>
      <Text style={styles.meta}>{expiresInLabel(story.expiresAt)}</Text>
      <Pressable
        onPress={confirm}
        hitSlop={8}
        disabled={remove.isPending}
        style={styles.deleteButton}
        accessibilityRole="button"
        accessibilityLabel="Delete this Instant"
      >
        {remove.isPending ? (
          <ActivityIndicator color={storyPalette.danger} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color={storyPalette.danger} />
            <Text style={[styles.meta, { color: storyPalette.danger }]}>Delete</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

type ReplyBarProps = {
  story: StoryDto;
  authorName: string;
  onFocusChange: (focused: boolean) => void;
  onOpenChat: (conversationId: string) => void;
};

/** Sends a private reply into the chat with the author; the story pauses while typing. */
function ReplyBar({ story, authorName, onFocusChange, onOpenChat }: ReplyBarProps) {
  const reply = useStoryReply();
  const inputRef = useRef<TextInputInstance>(null);
  const [text, setText] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const firstName = authorName.split(" ")[0] || authorName;
  const trimmed = text.trim();

  const send = () => {
    if (!trimmed || reply.isPending) return;
    setProblem(null);
    reply.mutate(
      { storyId: story.id, text: trimmed },
      {
        onSuccess: (result) => {
          setText("");
          setSentTo(result.conversationId);
          inputRef.current?.blur();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "CONNECTION_REQUIRED") {
            setProblem(`Connect with ${firstName} first to reply in chat.`);
          } else if (error instanceof ApiError && error.status === 404) {
            setProblem("This Instant is no longer available.");
          } else {
            setProblem("Could not send. Please try again.");
          }
        },
      },
    );
  };

  return (
    <View style={styles.replyWrap}>
      {problem ? (
        <Text style={styles.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : sentTo ? (
        <Pressable
          onPress={() => onOpenChat(sentTo)}
          style={styles.sentRow}
          accessibilityRole="button"
          accessibilityLabel={`Reply sent. Open chat with ${firstName}`}
        >
          <Ionicons name="checkmark-circle" size={16} color={storyPalette.white} />
          <Text style={styles.sentText}>Sent · View chat</Text>
        </Pressable>
      ) : null}
      <View style={styles.replyRow}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (problem) setProblem(null);
          }}
          onFocus={() => {
            setSentTo(null);
            onFocusChange(true);
          }}
          onBlur={() => onFocusChange(false)}
          onSubmitEditing={send}
          placeholder={`Reply to ${firstName}…`}
          placeholderTextColor={storyPalette.muted}
          maxLength={STORY_REPLY_MAX}
          returnKeyType="send"
          style={styles.replyInput}
          accessibilityLabel={`Reply to ${firstName}'s Instant`}
        />
        <Pressable
          onPress={send}
          disabled={!trimmed || reply.isPending}
          style={[styles.sendButton, (!trimmed || reply.isPending) && styles.sendDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Send reply"
        >
          {reply.isPending ? (
            <ActivityIndicator color={storyPalette.white} size="small" />
          ) : (
            <Ionicons name="send" size={18} color={storyPalette.white} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: {
    flex: 1,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: storyPalette.backdrop,
  },
  centered: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  tapZones: { ...StyleSheet.absoluteFill, flexDirection: "row" },
  tapPrevious: { flex: 3 },
  tapNext: { flex: 7 },
  topShade: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  progressRow: { flexDirection: "row", gap: 4 },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: storyPalette.track,
    overflow: "hidden",
  },
  segmentFill: { height: 3, backgroundColor: storyPalette.white },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  authorText: { flex: 1 },
  authorName: { color: storyPalette.white, fontSize: 15, fontWeight: "800" },
  meta: { color: storyPalette.text, fontSize: 13, fontWeight: "600", opacity: 0.85 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  storyText: { color: storyPalette.white, fontWeight: "800", textAlign: "center" },
  captionShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  caption: { color: storyPalette.white, fontSize: 17, fontWeight: "700", textAlign: "center" },
  problem: { color: storyPalette.danger, fontSize: 14, fontWeight: "700", textAlign: "center" },
  voiceAvatar: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  voiceLoading: {
    ...StyleSheet.absoluteFill,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: storyPalette.scrim,
  },
  voiceLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: storyPalette.scrim,
  },
  voiceText: { color: storyPalette.white, fontSize: 15, fontWeight: "700" },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  ownTools: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  deleteButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  replyWrap: { gap: spacing.sm },
  sentRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center" },
  sentText: { color: storyPalette.white, fontSize: 14, fontWeight: "700" },
  replyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  replyInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: storyPalette.glassBorder,
    paddingHorizontal: spacing.md,
    color: storyPalette.white,
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: storyPalette.accent,
  },
  sendDisabled: { opacity: 0.45 },
});
