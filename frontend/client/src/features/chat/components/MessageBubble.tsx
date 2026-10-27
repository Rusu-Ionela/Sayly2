import { useRecyclingState } from "@shopify/flash-list";
import { Image } from "expo-image";
import { memo } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "@/lib/api/errors";
import { remoteImageSource } from "@/lib/mediaUrl";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { isLocalMessageId } from "../cache";
import { VIDEO_NOTE_MARKER } from "../constants";
import type { ChatMessage } from "../types";
import { formatMessageClock } from "../utils/formatChatTime";
import { canTranslate } from "../utils/translation";
import { ChatVideo, ChatVoice } from "./ChatMedia";
import { MessageTicks } from "./MessageTicks";

type BusyKind = "translate" | "transcribe" | "correct" | "save" | null;

type MessageBubbleProps = {
  message: ChatMessage;
  isMine: boolean;
  onRetry?: (message: ChatMessage) => void;
  onTranslate?: (message: ChatMessage) => Promise<void>;
  onTranscribe?: (message: ChatMessage) => Promise<void>;
  onCorrect?: (message: ChatMessage, correctedText: string) => Promise<void>;
  onSavePhrase?: (message: ChatMessage) => Promise<void>;
};

function phraseSource(message: ChatMessage) {
  if (message.type === "TEXT") {
    return message.content.trim();
  }
  return (message.caption ?? message.transcript ?? "").trim();
}

function MessageBubbleComponent({
  message,
  isMine,
  onRetry,
  onTranslate,
  onTranscribe,
  onCorrect,
  onSavePhrase,
}: MessageBubbleProps) {
  const colors = useColors();
  const failed = message.localState === "failed";
  const sending = message.localState === "sending";
  // Rows are recycled by FlashList: this state belongs to one message and resets for the next.
  const rowKey = message.clientMessageId ?? message.id;
  const [busy, setBusy] = useRecyclingState<BusyKind>(null, [rowKey]);
  const [correctOpen, setCorrectOpen] = useRecyclingState(false, [rowKey]);
  const [correctionDraft, setCorrectionDraft] = useRecyclingState("", [rowKey]);
  const media = message.type === "IMAGE" || message.type === "VIDEO";
  const roundNote = message.type === "VIDEO" && message.thumbnailUrl === VIDEO_NOTE_MARKER;
  const canLearn = Boolean(phraseSource(message));

  const run = async (
    kind: Exclude<BusyKind, null>,
    action: () => Promise<void>,
    title: string,
  ): Promise<boolean> => {
    if (isLocalMessageId(message.id) || busy) return false;
    setBusy(kind);
    try {
      await action();
      return true;
    } catch (error) {
      let text = "Could not complete that action.";
      if (error instanceof ApiError) {
        if (error.status === 429 || error.isRateLimited) {
          text = "Too many requests. Please wait a moment and try again.";
        } else if (error.status === 501 || error.code === "NOT_IMPLEMENTED") {
          text =
            kind === "transcribe"
              ? "Transcription is not configured on this server yet."
              : "That learning action is not available right now.";
        } else if (error.status === 503) {
          text = "Service temporarily unavailable. Try again shortly.";
        } else {
          text = error.message;
        }
      }
      Alert.alert(title, text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const correctionText = correctionDraft.trim();
  const correctionHint = !correctionText
    ? "Enter the corrected text."
    : correctionText === phraseSource(message).trim()
      ? "Change the text to suggest a correction."
      : null;

  const submitCorrection = () => {
    const text = correctionText;
    if (correctionHint) {
      return;
    }
    setCorrectOpen(false);
    void (async () => {
      const ok = await run(
        "correct",
        () => onCorrect?.(message, text) ?? Promise.resolve(),
        "Correct",
      );
      if (ok) {
        Alert.alert("Correction sent", "Your partner can see this suggestion.");
      }
    })();
  };

  const mineBg = failed ? "#FEE2E2" : colors.accentSoft;
  const otherBg = failed ? "#FEE2E2" : colors.surface;
  const textColor = failed ? colors.rose : colors.text;
  const metaColor = failed ? colors.rose : colors.muted;

  return (
    <View style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapOther]}>
      <Pressable
        disabled={!failed}
        onPress={() => failed && onRetry?.(message)}
        accessibilityRole={failed ? "button" : undefined}
        accessibilityLabel={failed ? "Message failed. Tap to retry." : undefined}
      >
        <View
          style={[
            styles.bubble,
            media && !roundNote && styles.mediaBubble,
            roundNote && styles.noteBubble,
            isMine ? styles.bubbleMine : styles.bubbleOther,
            {
              backgroundColor: roundNote ? "transparent" : isMine ? mineBg : otherBg,
              shadowColor: colors.shadow,
            },
            sending && styles.pending,
          ]}
        >
          {message.type === "IMAGE" ? (
            <Image
              source={remoteImageSource(message.content)}
              recyclingKey={rowKey}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              accessibilityLabel="Photo"
            />
          ) : message.type === "VIDEO" ? (
            <ChatVideo key={message.content} uri={message.content} round={roundNote} />
          ) : message.type === "VOICE" ? (
            <ChatVoice
              key={message.content}
              uri={message.content}
              durationMs={message.durationMs}
              light={isMine}
            />
          ) : (
            <Text style={[styles.text, { color: textColor }]}>{message.content}</Text>
          )}

          {message.caption ? (
            <Text style={[styles.text, styles.caption, { color: textColor }]}>
              {message.caption}
            </Text>
          ) : null}

          {message.transcript ? (
            <Text style={[styles.extra, { color: metaColor }]}>{message.transcript}</Text>
          ) : null}
          {message.translatedContent ? (
            <View style={[styles.translation, { borderTopColor: metaColor }]}>
              {message.translatedLang ? (
                <Text style={[styles.translationLang, { color: metaColor }]}>
                  🌐 {message.translatedLang.toUpperCase()}
                </Text>
              ) : null}
              <Text style={[styles.extra, { color: textColor }]}>{message.translatedContent}</Text>
            </View>
          ) : null}
          {message.correction ? (
            <View
              style={[styles.correction, { borderLeftColor: colors.accent }]}
              accessibilityLabel={`${isMine ? "Your partner suggested" : "You suggested"}: ${message.correction.correctedText}`}
            >
              <Text style={[styles.correctionLabel, { color: colors.accent }]}>
                {isMine ? "✏️ Suggested correction" : "✏️ Your correction"}
              </Text>
              <Text style={[styles.correctionText, { color: textColor }]}>
                {message.correction.correctedText}
              </Text>
            </View>
          ) : null}

          <View style={styles.meta}>
            <Text style={[styles.time, { color: metaColor }]}>
              {formatMessageClock(message.createdAt)}
            </Text>
            {isMine ? <MessageTicks message={message} compact /> : null}
          </View>
        </View>
      </Pressable>

      {!failed && !sending && !isLocalMessageId(message.id) ? (
        <View style={styles.actions}>
          {message.type === "VOICE" || message.type === "VIDEO" ? (
            <Pressable
              onPress={() =>
                void run(
                  "transcribe",
                  () => onTranscribe?.(message) ?? Promise.resolve(),
                  "Transcribe",
                )
              }
              disabled={busy !== null}
            >
              <Text style={[styles.action, { color: colors.accent }]}>
                {busy === "transcribe"
                  ? "Transcribing…"
                  : message.transcript
                    ? "Transcribed"
                    : "Transcribe"}
              </Text>
            </Pressable>
          ) : null}
          {canTranslate(message) ? (
            <Pressable
              onPress={() =>
                void run(
                  "translate",
                  () => onTranslate?.(message) ?? Promise.resolve(),
                  "Translate",
                )
              }
              disabled={busy !== null}
            >
              <Text style={[styles.action, { color: colors.accent }]}>
                {busy === "translate"
                  ? "Translating…"
                  : message.translatedContent
                    ? "Translated"
                    : "Translate"}
              </Text>
            </Pressable>
          ) : null}
          {!isMine && canLearn && onCorrect ? (
            <Pressable
              onPress={() => {
                setCorrectionDraft(phraseSource(message));
                setCorrectOpen(true);
              }}
              disabled={busy !== null}
            >
              <Text style={[styles.action, { color: colors.accent }]}>
                {busy === "correct" ? "Sending…" : "Correct"}
              </Text>
            </Pressable>
          ) : null}
          {canLearn && onSavePhrase ? (
            <Pressable
              onPress={() =>
                void (async () => {
                  const ok = await run("save", () => onSavePhrase(message), "Save phrase");
                  if (ok) {
                    Alert.alert("Saved", "Phrase added to Saved phrases.");
                  }
                })()
              }
              disabled={busy !== null}
            >
              <Text style={[styles.action, { color: colors.accent }]}>
                {busy === "save" ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {failed ? (
        <Text style={[styles.failedHint, { color: colors.rose }]}>Tap to retry</Text>
      ) : sending ? (
        <Text style={[styles.failedHint, { color: colors.muted }]}>Sending…</Text>
      ) : null}

      <Modal
        visible={correctOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCorrectOpen(false)}
      >
        <KeyboardSafeView style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Suggest a correction</Text>
            <TextInput
              value={correctionDraft}
              onChangeText={setCorrectionDraft}
              multiline
              autoFocus
              placeholder="Corrected text"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.card,
                  color: colors.text,
                },
              ]}
            />
            {correctionHint ? (
              <Text style={[styles.correctionHint, { color: colors.muted }]}>{correctionHint}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.secondary, { backgroundColor: colors.card }]}
                onPress={() => setCorrectOpen(false)}
              >
                <Text style={[styles.secondaryText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primary,
                  { backgroundColor: colors.accent },
                  correctionHint ? styles.primaryDisabled : null,
                ]}
                onPress={submitCorrection}
                disabled={Boolean(correctionHint)}
                accessibilityRole="button"
                accessibilityState={{ disabled: Boolean(correctionHint) }}
              >
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Send</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 3,
    maxWidth: "78%",
  },
  wrapMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  wrapOther: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleMine: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 5,
  },
  bubbleOther: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 18,
  },
  mediaBubble: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
  },
  noteBubble: {
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  pending: {
    opacity: 0.78,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  extra: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  translation: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  translationLang: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  correction: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    gap: 2,
  },
  correctionLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  correctionText: {
    fontSize: 14,
    lineHeight: 19,
  },
  image: {
    width: 228,
    height: 228,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  time: {
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  action: {
    fontSize: 12,
    fontWeight: "600",
  },
  failedHint: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  correctionHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(42,40,38,0.35)",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 96,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontWeight: "700",
  },
  primary: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontWeight: "800",
  },
});
