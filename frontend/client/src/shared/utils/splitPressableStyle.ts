import type { ViewStyle } from "react-native";

/** Keys that lay out children; they must live on the inner Pressable, not the animated shell. */
const CONTENT_LAYOUT_KEYS = [
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "gap",
  "rowGap",
  "columnGap",
] as const;

/** Split a flattened style into shell (size, decoration) and content (child layout). */
export function splitPressableStyle(flat: ViewStyle | undefined) {
  const shell: ViewStyle = { ...flat };
  const content: ViewStyle = {};
  for (const key of CONTENT_LAYOUT_KEYS) {
    if (shell[key] !== undefined) {
      (content as Record<string, unknown>)[key] = shell[key];
      delete shell[key];
    }
  }
  return { shell, content };
}
