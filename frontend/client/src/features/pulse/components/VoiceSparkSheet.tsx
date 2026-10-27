import { Ionicons } from "@expo/vector-icons";
import { VOICE_SPARK_MAX_MS, type VoiceSparkDto } from "@sayly/shared";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PracticeLanguage } from "@/features/icebreakers/hooks";
import { claimMediaPlayback, releaseMediaPlayback } from "@/features/chat/mediaPlayback";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Avatar } from "@/shared/components/Avatar";
import { spacing } from "@/shared/theme/spacing";

import type { RecordedNote } from "../api";
import { useDeleteVoiceSpark, usePostVoiceSpark } from "../hooks";
import { expiresInLabel, formatCountdown } from "../model";
import { pulsePalette } from "../palette";
import { useVoiceNoteRecorder } from "../voiceRecorder";
import { PulseHalo } from "./PulseHalo";

export type SparkSheetState = {
  /** Sparks to play in order; empty = just record a new spark. */
  queue: VoiceSparkDto[];
  index: number;
  /** The viewer's own spark and its replies: record a new spark instead of replying. */
  ownerView: boolean;
};

type VoiceSparkSheetProps = {
  state: SparkSheetState | null;
  viewerId: string | undefined;
  languages: PracticeLanguage[];
  onPlayed: (sparkId: string) => void;
  onClose: () => void;
};

/** Full-screen stories-style player: plays each spark on open, then the next one. */
export function VoiceSparkSheet({
  state,
  viewerId,
  languages,
  onPlayed,
  onClose,
}: VoiceSparkSheetProps) {
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  // SafeAreaView reports no insets inside a Modal on iOS, which hid the close button under the notch.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setIndex(state?.index ?? 0);
    setRecording(false);
  }, [state]);

  const queue = state?.queue ?? [];
  const spark = queue[index];
  const isOwn = Boolean(spark && spark.author.id === viewerId);

  const advance = useCallback(() => {
    setIndex((current) => (current + 1 < queue.length ? current + 1 : current));
  }, [queue.length]);

  return (
    <Modal visible={Boolean(state)} animationType="slide" transparent onRequestClose={onClose}>
      <LinearGradient colors={[pulsePalette.deepEdge, pulsePalette.deep]} style={styles.fill}>
        <View
          style={[
            styles.fill,
            { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.topBar}>
            <View style={styles.progressRow}>
              {queue.map((item, position) => (
                <View
                  key={item.id}
                  style={[
                    styles.progressSegment,
                    { backgroundColor: position <= index ? pulsePalette.neon : pulsePalette.glass },
                  ]}
                />
              ))}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={26} color={pulsePalette.text} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {spark ? (
              <SparkPlayer
                key={spark.id}
                spark={spark}
                suspended={recording}
                isReply={Boolean(spark.replyToId)}
                onStarted={() => onPlayed(spark.id)}
                onFinished={advance}
              />
            ) : (
              <View style={styles.intro}>
                <Text style={styles.title}>Your Voice Spark</Text>
                <Text style={styles.subtitle}>
                  Say something in the language you’re learning — up to 15 seconds. It disappears
                  after 24 hours.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            {isOwn && spark && !spark.replyToId ? (
              <OwnSparkTools spark={spark} onDeleted={onClose} />
            ) : null}
            {spark && !isOwn ? (
              <SparkRecorder
                key={`reply-${spark.id}`}
                label="Reply in Voice"
                languageId={spark.languageId}
                replyToId={spark.id}
                onRecordingChange={setRecording}
              />
            ) : state?.ownerView || !spark ? (
              <NewSparkRecorder
                languages={languages}
                onRecordingChange={setRecording}
                onPosted={onClose}
              />
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

type SparkPlayerProps = {
  spark: VoiceSparkDto;
  suspended: boolean;
  isReply: boolean;
  onStarted: () => void;
  onFinished: () => void;
};

function SparkPlayer({ spark, suspended, isReply, onStarted, onFinished }: SparkPlayerProps) {
  const playbackId = useId();
  const player = useAudioPlayer(resolveMediaUrl(spark.audioUrl) ?? spark.audioUrl);
  const status = useAudioPlayerStatus(player);
  const started = useRef(false);
  const finished = useRef(false);
  const [stalled, setStalled] = useState(false);

  // An audio file that never loads must not leave a spinner forever.
  useEffect(() => {
    if (status.isLoaded) return;
    const timer = setTimeout(() => setStalled(true), 10_000);
    return () => clearTimeout(timer);
  }, [status.isLoaded]);

  const play = useCallback(() => {
    claimMediaPlayback(playbackId, () => {
      try {
        player.pause();
      } catch {
        // the player may already be gone
      }
    });
    player.play();
  }, [playbackId, player]);

  // Autoplay as soon as the file is ready.
  useEffect(() => {
    if (status.isLoaded && !started.current && !suspended) {
      started.current = true;
      play();
      onStarted();
    }
  }, [onStarted, play, status.isLoaded, suspended]);

  useEffect(() => {
    if (suspended && status.playing) player.pause();
  }, [player, status.playing, suspended]);

  useEffect(() => {
    if (status.didJustFinish && !finished.current) {
      finished.current = true;
      setTimeout(onFinished, 700);
    }
  }, [onFinished, status.didJustFinish]);

  useEffect(
    () => () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
      releaseMediaPlayback(playbackId);
    },
    [playbackId, player],
  );

  const durationMs = status.duration > 0 ? status.duration * 1000 : spark.durationMs;
  const progress = durationMs > 0 ? Math.min(1, (status.currentTime * 1000) / durationMs) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.duration > 0 && status.currentTime >= status.duration - 0.05) {
      finished.current = false;
      void player.seekTo(0).then(play);
      return;
    }
    play();
  };

  return (
    <View style={styles.player}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause Voice Spark" : "Play Voice Spark"}
        style={styles.bigAvatar}
      >
        <PulseHalo size={148} color={pulsePalette.neon} active={status.playing} />
        <PulseHalo size={148} color={pulsePalette.glow} active={status.playing} delayMs={900} />
        <Avatar uri={spark.author.avatarUrl} name={spark.author.displayName} size={148} />
        {!status.isLoaded ? (
          <View style={styles.loading}>
            {stalled ? (
              <Ionicons name="cloud-offline-outline" size={36} color={pulsePalette.white} />
            ) : (
              <ActivityIndicator color={pulsePalette.white} />
            )}
          </View>
        ) : !status.playing ? (
          <View style={styles.loading}>
            <Ionicons name="play" size={40} color={pulsePalette.white} />
          </View>
        ) : null}
      </Pressable>

      <Text style={styles.title}>{spark.author.displayName}</Text>
      {stalled && !status.isLoaded ? (
        <Text style={styles.problem}>This Voice Spark could not be loaded.</Text>
      ) : null}
      <Text style={styles.subtitle}>
        {isReply ? "Voice reply · " : ""}
        {spark.flagEmoji ? `${spark.flagEmoji} ` : ""}
        {spark.languageName} · {expiresInLabel(spark.expiresAt)}
      </Text>

      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.time}>
        {formatCountdown(status.currentTime * 1000)} / {formatCountdown(durationMs)}
      </Text>
    </View>
  );
}

function OwnSparkTools({ spark, onDeleted }: { spark: VoiceSparkDto; onDeleted: () => void }) {
  const remove = useDeleteVoiceSpark();
  const confirm = () =>
    Alert.alert("Delete this Voice Spark?", "Replies to it are deleted too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove.mutate(spark.id, { onSuccess: onDeleted }),
      },
    ]);
  return (
    <View style={styles.ownTools}>
      <Text style={styles.subtitle}>
        {spark.replyCount === 1 ? "1 voice reply" : `${spark.replyCount} voice replies`}
      </Text>
      <Pressable
        onPress={confirm}
        hitSlop={8}
        accessibilityRole="button"
        disabled={remove.isPending}
      >
        <Text style={[styles.link, { color: pulsePalette.danger }]}>Delete</Text>
      </Pressable>
    </View>
  );
}

type RecorderProps = {
  onRecordingChange: (recording: boolean) => void;
};

function NewSparkRecorder({
  languages,
  onRecordingChange,
  onPosted,
}: RecorderProps & { languages: PracticeLanguage[]; onPosted: () => void }) {
  const [languageId, setLanguageId] = useState(languages[0]?.id);
  const language = languages.find((item) => item.id === languageId) ?? languages[0];

  if (!language) {
    return (
      <Text style={styles.subtitle}>Add a language you’re learning to post Voice Sparks.</Text>
    );
  }

  return (
    <View style={styles.newSpark}>
      {languages.length > 1 ? (
        <View style={styles.languageRow}>
          {languages.map((item) => {
            const active = item.id === language.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setLanguageId(item.id)}
                style={[styles.languageChip, active && { backgroundColor: pulsePalette.glow }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.languageText}>
                  {item.flagEmoji ? `${item.flagEmoji} ` : ""}
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <SparkRecorder
        label={`Record in ${language.name}`}
        languageId={language.id}
        onRecordingChange={onRecordingChange}
        onPosted={onPosted}
      />
    </View>
  );
}

/** Tap to record, tap again to send; stops and sends by itself at 15 s. */
function SparkRecorder({
  label,
  languageId,
  replyToId,
  onRecordingChange,
  onPosted,
}: RecorderProps & {
  label: string;
  languageId: string;
  replyToId?: string;
  onPosted?: () => void;
}) {
  const post = usePostVoiceSpark();
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = useCallback(
    (note: RecordedNote | null) => {
      onRecordingChange(false);
      if (!note) {
        setProblem("That was too short — hold on for at least a second.");
        return;
      }
      setProblem(null);
      post.mutate(
        { note, languageId, replyToId },
        {
          onSuccess: () => {
            setSent(true);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            onPosted?.();
          },
          // Shown in the sheet: an Alert over a Modal is easy to miss on iOS.
          onError: (error) =>
            setProblem(
              `Could not send: ${error instanceof Error ? error.message : "please try again."}`,
            ),
        },
      );
    },
    [languageId, onPosted, onRecordingChange, post, replyToId],
  );

  const recorder = useVoiceNoteRecorder(VOICE_SPARK_MAX_MS, send);

  const onPress = async () => {
    if (recorder.recording) {
      send(await recorder.stop());
      return;
    }
    setSent(false);
    setProblem(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onRecordingChange(await recorder.start());
  };

  const cancel = async () => {
    await recorder.cancel();
    onRecordingChange(false);
  };

  const remaining = VOICE_SPARK_MAX_MS - recorder.elapsedMs;

  return (
    <View style={styles.recorder}>
      {problem ? (
        <Text style={styles.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : null}
      {recorder.recording ? (
        <View style={styles.recordTrack}>
          <View
            style={[
              styles.recordFill,
              { width: `${(recorder.elapsedMs / VOICE_SPARK_MAX_MS) * 100}%` },
            ]}
          />
        </View>
      ) : null}
      <View style={styles.recordRow}>
        {recorder.recording ? (
          <Pressable
            onPress={() => void cancel()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
          >
            <Ionicons name="trash-outline" size={24} color={pulsePalette.muted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void onPress()}
          disabled={post.isPending}
          accessibilityRole="button"
          accessibilityLabel={recorder.recording ? "Stop and send" : label}
          style={({ pressed }) => [
            styles.recordButton,
            { backgroundColor: recorder.recording ? pulsePalette.danger : pulsePalette.glow },
            pressed && { opacity: 0.85 },
          ]}
        >
          {post.isPending ? (
            <ActivityIndicator color={pulsePalette.white} />
          ) : (
            <>
              <Ionicons
                name={recorder.recording ? "send" : sent ? "checkmark" : "mic"}
                size={20}
                color={pulsePalette.white}
              />
              <Text style={styles.recordText}>
                {recorder.recording
                  ? `Send · ${formatCountdown(remaining)} left`
                  : sent
                    ? "Sent! Record another"
                    : label}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: pulsePalette.glass,
  },
  problem: { color: pulsePalette.danger, fontSize: 14, fontWeight: "700", textAlign: "center" },
  progressRow: { flex: 1, flexDirection: "row", gap: 4 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  intro: { alignItems: "center", gap: spacing.sm },
  player: { alignItems: "center", gap: spacing.sm },
  bigAvatar: {
    width: 148,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 74,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 10, 31, 0.45)",
  },
  title: { color: pulsePalette.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { color: pulsePalette.muted, fontSize: 15, fontWeight: "600", textAlign: "center" },
  track: {
    alignSelf: "stretch",
    height: 4,
    borderRadius: 2,
    backgroundColor: pulsePalette.glass,
    marginTop: spacing.lg,
    overflow: "hidden",
  },
  trackFill: { height: 4, backgroundColor: pulsePalette.neon },
  time: { color: pulsePalette.muted, fontSize: 13, fontVariant: ["tabular-nums"] },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  ownTools: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { fontSize: 15, fontWeight: "800" },
  newSpark: { gap: spacing.md },
  languageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  languageChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: pulsePalette.glass,
  },
  languageText: { color: pulsePalette.text, fontSize: 14, fontWeight: "700" },
  recorder: { gap: spacing.sm },
  recordTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: pulsePalette.glass,
    overflow: "hidden",
  },
  recordFill: { height: 4, backgroundColor: pulsePalette.danger },
  recordRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  recordButton: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  recordText: { color: pulsePalette.white, fontSize: 16, fontWeight: "800" },
});
