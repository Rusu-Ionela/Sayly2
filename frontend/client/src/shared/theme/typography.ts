import type { ThemeColors } from "./colors";

export function getTypography(colors: ThemeColors) {
  return {
    screenTitle: {
      fontSize: 30,
      fontWeight: "700" as const,
      color: colors.text,
      letterSpacing: -0.6,
    },
    screenSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      fontWeight: "500" as const,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: colors.muted,
      letterSpacing: 0.5,
      textTransform: "uppercase" as const,
    },
    cardTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "700" as const,
      color: colors.text,
      letterSpacing: -0.3,
    },
    body: {
      fontSize: 15,
      lineHeight: 23,
      color: colors.text,
      fontWeight: "400" as const,
    },
    button: {
      fontSize: 16,
      fontWeight: "700" as const,
      letterSpacing: 0.1,
    },
  } as const;
}
