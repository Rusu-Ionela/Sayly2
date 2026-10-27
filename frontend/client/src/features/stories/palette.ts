import { darkColors } from "@/shared/theme/colors";

/** Unwatched stories: warm ring, so they read apart from the indigo Voice Spark rings. */
export const storyRingGradient = ["#F59E0B", "#F43F5E", darkColors.primary] as const;

/** Backdrops for text stories, picked per story id. */
export const textStoryBackgrounds = [
  ["#4C35F5", "#C084FC"],
  ["#F43F5E", "#F59E0B"],
  ["#0EA5E9", "#6366F1"],
  ["#10B981", "#0EA5E9"],
  ["#1E1B4B", "#6366F1"],
] as const satisfies readonly (readonly [string, string])[];

/** The viewer and composer stay dark in both themes, like the other full-screen media. */
export const storyPalette = {
  backdrop: "#000000",
  text: darkColors.text,
  muted: darkColors.muted,
  white: darkColors.white,
  accent: darkColors.primary,
  danger: darkColors.rose,
  track: "rgba(255, 255, 255, 0.32)",
  glass: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(255, 255, 255, 0.22)",
  scrim: "rgba(0, 0, 0, 0.35)",
} as const;
