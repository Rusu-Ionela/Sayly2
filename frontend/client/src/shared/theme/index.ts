import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

import { type ThemeColors, type ThemeScheme } from "./colors";

export type { ThemeColors, ThemeScheme } from "./colors";
export { ThemeProvider, useColors, useTheme, useThemeScheme } from "./ThemeProvider";

export function navigationThemeFor(scheme: ThemeScheme, colors: ThemeColors): Theme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: "transparent",
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.rose,
    },
  };
}
