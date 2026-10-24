import { useColors, useThemeScheme } from "@/shared/theme";

export function useAuthCopyColors() {
  const scheme = useThemeScheme();
  const colors = useColors();
  const dark = scheme === "dark";

  return {
    tone: dark ? ("dark" as const) : ("light" as const),
    title: dark ? "#FFFFFF" : colors.text,
    subtitle: dark ? "rgba(255,255,255,0.88)" : colors.muted,
    muted: dark ? "rgba(255,255,255,0.7)" : colors.muted,
    link: dark ? "#93C5FD" : colors.accent,
    error: dark ? "#FCA5A5" : colors.error,
    close: dark ? "#FFFFFF" : colors.text,
    bannerBg: dark ? "rgba(255,255,255,0.1)" : colors.accentSoft,
    bannerBorder: dark ? "rgba(255,255,255,0.22)" : colors.cardBorder,
    bannerText: dark ? "rgba(255,255,255,0.92)" : colors.text,
  };
}
