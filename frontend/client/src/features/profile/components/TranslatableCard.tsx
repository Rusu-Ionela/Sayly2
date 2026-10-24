import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { translateProfileField, type TranslatableProfileField } from "../api/profileApi";

type TranslatableCardProps = {
  title: string;
  body: string;
  /** Render inside another card: no background, padding or title of its own. */
  bare?: boolean;
  /** Pass both to show a Translate link; omit for text that can't be translated. */
  translate?: { userId: string; field: TranslatableProfileField };
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; text: string; showing: "translated" | "original" };

export function TranslatableCard({ title, body, bare, translate }: TranslatableCardProps) {
  const colors = useColors();
  const [state, setState] = useState<State>({ kind: "idle" });

  const run = async () => {
    if (!translate) return;
    setState({ kind: "loading" });
    try {
      const result = await translateProfileField(translate.userId, translate.field);
      setState({ kind: "done", text: result.text, showing: "translated" });
    } catch {
      setState({ kind: "error" });
    }
  };

  const shown = state.kind === "done" && state.showing === "translated" ? state.text : body;
  const link =
    state.kind === "loading"
      ? "Translating…"
      : state.kind === "error"
        ? "Couldn’t translate. Tap to retry"
        : state.kind === "done"
          ? state.showing === "translated"
            ? "Show original"
            : "Show translation"
          : "Translate";

  return (
    <View style={bare ? styles.bare : [styles.card, { backgroundColor: colors.card }]}>
      {bare ? null : <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
      <Text style={[styles.body, { color: colors.muted }]}>{shown}</Text>
      {translate ? (
        <Pressable
          onPress={() => {
            if (state.kind === "done") {
              setState({
                ...state,
                showing: state.showing === "translated" ? "original" : "translated",
              });
            } else if (state.kind !== "loading") {
              void run();
            }
          }}
          disabled={state.kind === "loading"}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${link}: ${title}`}
        >
          <Text
            style={[styles.link, { color: state.kind === "error" ? colors.rose : colors.accent }]}
          >
            {link}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bare: { gap: 6 },
  card: { borderRadius: radius.lg, padding: spacing.md, gap: 6 },
  title: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  link: { fontSize: 14, fontWeight: "600", marginTop: 2 },
});
