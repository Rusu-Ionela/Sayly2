import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

type FeedComposerProps = {
  placeholder: string;
  maxLength: number;
  onSend: (text: string) => void;
  /** Extra control left of the input, e.g. the thought/question switch. */
  leading?: React.ReactNode;
  accessibilityLabel: string;
};

/** Bottom composer used by the feed (new post) and the post thread (new comment). */
export function FeedComposer({
  placeholder,
  maxLength,
  onSend,
  leading,
  accessibilityLabel,
}: FeedComposerProps) {
  const colors = useColors();
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();

  const send = () => {
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <View
      style={[styles.wrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}
    >
      {leading}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
      />
      <PressableScale
        onPress={send}
        disabled={!trimmed}
        style={[styles.send, { backgroundColor: trimmed ? colors.accent : colors.trail }]}
        accessibilityRole="button"
        accessibilityLabel="Send"
      >
        <Ionicons name="arrow-up" size={20} color={trimmed ? colors.onPrimary : colors.muted} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
