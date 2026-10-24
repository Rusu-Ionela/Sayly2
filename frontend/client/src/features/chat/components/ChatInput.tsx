import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/shared/theme";

import type { ChatMediaDraft } from "../types";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { RecordSendButton } from "./RecordSendButton";

/** One line of text plus padding. */
const INPUT_MIN_HEIGHT = 40;
/** About six lines; longer drafts scroll inside the field. */
const INPUT_MAX_HEIGHT = 150;

export type { ChatMediaDraft };

type ChatInputProps = {
  onSend: (body: string) => void;
  onSendMedia: (draft: ChatMediaDraft) => void;
  onTypingChange?: (typing: boolean) => void;
  disabled?: boolean;
};

const TYPING_IDLE_MS = 2500;
/** Soft keep-alive while still typing — sparse enough to stay under the typing rate limit. */
const TYPING_KEEPALIVE_MS = 6000;

function durationFromAsset(duration?: number | null) {
  if (duration == null || duration <= 0) return undefined;
  return duration < 1000 ? Math.round(duration * 1000) : Math.round(duration);
}

export function ChatInput({ onSend, onSendMedia, onTypingChange, disabled }: ChatInputProps) {
  const colors = useColors();
  const [value, setValue] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [preview, setPreview] = useState<ChatMediaDraft | null>(null);
  const typing = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (keepAliveTimer.current) {
      clearInterval(keepAliveTimer.current);
      keepAliveTimer.current = null;
    }
  };

  const stopTyping = useCallback(() => {
    clearTimers();
    if (typing.current) {
      typing.current = false;
      onTypingChange?.(false);
    }
  }, [onTypingChange]);

  const startTyping = useCallback(() => {
    if (!typing.current) {
      typing.current = true;
      onTypingChange?.(true);
    }
    if (!keepAliveTimer.current) {
      keepAliveTimer.current = setInterval(() => {
        if (typing.current) {
          onTypingChange?.(true);
        }
      }, TYPING_KEEPALIVE_MS);
    }
  }, [onTypingChange]);

  const handleChange = useCallback(
    (next: string) => {
      setValue(next);
      if (disabled) return;

      if (next.trim()) {
        startTyping();
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
      } else {
        stopTyping();
      }
    },
    [disabled, startTyping, stopTyping],
  );

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    stopTyping();
    setValue("");
    onSend(trimmed);
  }, [disabled, onSend, stopTyping, value]);

  const pick = useCallback(async (source: "library" | "camera", media: "images" | "videos") => {
    setAttachOpen(false);
    const permission =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow access to send photos and videos.");
      return;
    }

    const result =
      source === "library"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: [media],
            quality: 0.85,
            videoMaxDuration: 60,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: [media],
            quality: 0.85,
            videoMaxDuration: 60,
          });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPreview({
      type: media === "images" ? "IMAGE" : "VIDEO",
      uri: asset.uri,
      mimeType: asset.mimeType ?? (media === "images" ? "image/jpeg" : "video/mp4"),
      fileName: asset.fileName ?? (media === "images" ? "photo.jpg" : "video.mp4"),
      durationMs: durationFromAsset(asset.duration),
    });
  }, []);

  const canSend = Boolean(value.trim()) && !disabled;

  useEffect(() => {
    return () => {
      clearTimers();
      onTypingChange?.(false);
    };
  }, [onTypingChange]);

  return (
    <View
      style={[styles.wrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}
    >
      <View style={styles.row}>
        <Pressable
          onPress={() => setAttachOpen(true)}
          disabled={disabled}
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Attach photo or video"
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder="Message"
          placeholderTextColor={colors.placeholder}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
            },
          ]}
          editable={!disabled}
          multiline
          // Grows line by line up to INPUT_MAX_HEIGHT, then scrolls; text starts at the top
          // (Android centres it vertically by default, which hid the first line).
          scrollEnabled
          textAlignVertical="top"
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          accessibilityLabel="Message"
        />
        {canSend ? (
          <Pressable
            onPress={handleSend}
            style={[styles.send, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        ) : (
          <RecordSendButton disabled={disabled} onSendMedia={onSendMedia} />
        )}
      </View>

      <Modal
        visible={attachOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAttachOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Send media</Text>
            <Pressable style={styles.sheetRow} onPress={() => void pick("library", "images")}>
              <Ionicons name="image-outline" size={20} color={colors.accent} />
              <Text style={[styles.sheetText, { color: colors.text }]}>Photo from gallery</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => void pick("camera", "images")}>
              <Ionicons name="camera-outline" size={20} color={colors.accent} />
              <Text style={[styles.sheetText, { color: colors.text }]}>Take a photo</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => void pick("library", "videos")}>
              <Ionicons name="film-outline" size={20} color={colors.accent} />
              <Text style={[styles.sheetText, { color: colors.text }]}>Video from gallery</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => void pick("camera", "videos")}>
              <Ionicons name="videocam-outline" size={20} color={colors.accent} />
              <Text style={[styles.sheetText, { color: colors.text }]}>Record a video</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <MediaPreviewModal
        draft={preview}
        onClose={() => setPreview(null)}
        onSend={(draft) => {
          setPreview(null);
          onSendMedia(draft);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "visible",
    zIndex: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    overflow: "visible",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? 8 : 10,
    paddingBottom: Platform.OS === "android" ? 8 : 10,
    fontSize: 16,
    // A fixed lineHeight makes Android size a multiline input one line short, hiding the
    // line being typed; let Android measure the text itself.
    ...(Platform.OS === "ios" ? { lineHeight: 21 } : { includeFontPadding: false }),
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "flex-end",
    padding: 12,
  },
  sheet: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  sheetText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
