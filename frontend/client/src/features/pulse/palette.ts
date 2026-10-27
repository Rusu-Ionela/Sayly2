import { darkColors } from "@/shared/theme/colors";

/**
 * The Live Language Pulse surfaces (radar, sparks player, quest) stay dark in both themes so
 * the neon accents glow. Everything except the deep backdrop comes from the dark theme tokens.
 */
export const pulsePalette = {
  deep: "#0B0A1F",
  deepEdge: "#16134A",
  neon: darkColors.mint,
  glow: darkColors.primary,
  text: darkColors.text,
  muted: darkColors.muted,
  online: darkColors.presence,
  ring: "rgba(129, 140, 248, 0.22)",
  ringStrong: "rgba(129, 140, 248, 0.5)",
  glass: "rgba(255, 255, 255, 0.06)",
  glassBorder: "rgba(255, 255, 255, 0.10)",
  danger: darkColors.rose,
  white: darkColors.white,
} as const;

/** Spark rings: unheard sparks glow, heard ones fade back. */
export const sparkGradient = [darkColors.mint, darkColors.primary, "#C084FC"] as const;
