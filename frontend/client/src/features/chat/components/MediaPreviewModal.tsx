import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme";

import type { ChatMediaDraft } from "../types";
import { ChatVideo } from "./ChatMedia";

type MediaPreviewModalProps = {
  draft: ChatMediaDraft | null;
  onClose: () => void;
  onSend: (draft: ChatMediaDraft) => void;
};

export function MediaPreviewModal({ draft, onClose, onSend }: MediaPreviewModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");

  useEffect(() => {
    setCaption(draft?.caption ?? "");
  }, [draft]);

  if (!draft) {
    return null;
  }

  const send = () => {
    const trimmed = caption.trim();
    onSend({ ...draft, caption: trimmed || undefined });
    setCaption("");
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardSafeView
        style={[styles.screen, { backgroundColor: "#0B0F1A", paddingTop: insets.top }]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={styles.iconHit}
          >
            <Ionicons name="close" size={26} color="#F8FAFC" />
          </Pressable>
          <Text style={styles.topTitle}>{draft.type === "VIDEO" ? "Video" : "Photo"}</Text>
          <View style={styles.iconHit} />
        </View>

        <View style={styles.preview}>
          {draft.type === "VIDEO" ? (
            <ChatVideo uri={draft.uri} fill />
          ) : (
            <Image source={{ uri: draft.uri }} style={styles.media} resizeMode="contain" />
          )}
        </View>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption…"
            placeholderTextColor="rgba(248,250,252,0.45)"
            style={styles.caption}
            multiline
            maxLength={1000}
            accessibilityLabel="Caption"
          />
          <Pressable
            onPress={send}
            style={[styles.send, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  topTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  caption: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#F8FAFC",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
