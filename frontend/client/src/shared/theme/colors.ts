export type ThemeScheme = "light" | "dark";

export type ThemeColors = {
  background: string;
  surface: string;
  card: string;
  primary: string;
  accent: string;
  accentSoft: string;
  mint: string;
  mintSoft: string;
  text: string;
  muted: string;
  label: string;
  placeholder: string;
  onPrimary: string;
  white: string;
  border: string;
  error: string;
  rose: string;
  shadow: string;
  overlay: string;
  inputBg: string;
  orbPrimary: string;
  orbSoft: string;
  cardBorder: string;
  segmentText: string;
  chipSpokenBg: string;
  chipSpokenText: string;
  chipLearningBg: string;
  chipLearningText: string;
  presence: string;
  trail: string;
  pulse: string;
  /** Pro membership badge. */
  pro: string;
  proSoft: string;
};

/** Light — #F8F9FE wash, brand #4C35F5 used sparingly. */
export const lightColors: ThemeColors = {
  background: "#F8F9FE",
  surface: "#F1F3FB",
  card: "#FFFFFF",
  primary: "#4C35F5",
  accent: "#4C35F5",
  accentSoft: "#E8EBFD",
  mint: "#4C35F5",
  mintSoft: "#E8EBFD",
  text: "#1E1B4B",
  muted: "#64748B",
  label: "#475569",
  placeholder: "#94A3B8",
  onPrimary: "#FFFFFF",
  white: "#FFFFFF",
  border: "#E8EBFD",
  error: "#DC2626",
  rose: "#DC2626",
  shadow: "rgba(30, 27, 75, 0.06)",
  overlay: "rgba(30, 27, 75, 0.28)",
  inputBg: "#F1F3FB",
  orbPrimary: "rgba(76, 53, 245, 0.08)",
  orbSoft: "rgba(199, 210, 254, 0.45)",
  cardBorder: "rgba(76, 53, 245, 0.08)",
  segmentText: "#475569",
  chipSpokenBg: "#F1F3FB",
  chipSpokenText: "#1E1B4B",
  chipLearningBg: "#E8EBFD",
  chipLearningText: "#4C35F5",
  presence: "#34D399",
  trail: "#C7D2FE",
  pulse: "#4C35F5",
  pro: "#B45309",
  proSoft: "#FEF3C7",
};

/** Dark — indigo-slate #0F172A, trails #334155, wordmark #6366F1. */
export const darkColors: ThemeColors = {
  background: "#1C1C1E",
  surface: "#2A2A2C",
  card: "#2A2A2C",
  primary: "#6366F1",
  accent: "#6366F1",
  accentSoft: "rgba(76, 53, 245, 0.22)",
  mint: "#818CF8",
  mintSoft: "rgba(99, 102, 241, 0.18)",
  text: "#E2E8F0",
  muted: "#94A3B8",
  label: "#94A3B8",
  placeholder: "#64748B",
  onPrimary: "#FFFFFF",
  white: "#FFFFFF",
  border: "rgba(255, 255, 255, 0.08)",
  error: "#F87171",
  rose: "#F87171",
  shadow: "rgba(0, 0, 0, 0.35)",
  overlay: "rgba(0, 0, 0, 0.55)",
  inputBg: "#2A2A2C",
  orbPrimary: "rgba(76, 53, 245, 0.16)",
  orbSoft: "rgba(51, 65, 85, 0.5)",
  cardBorder: "rgba(148, 163, 184, 0.12)",
  segmentText: "#94A3B8",
  chipSpokenBg: "rgba(51, 65, 85, 0.7)",
  chipSpokenText: "#E2E8F0",
  chipLearningBg: "rgba(76, 53, 245, 0.2)",
  chipLearningText: "#C7D2FE",
  presence: "#34D399",
  trail: "#334155",
  pulse: "#4C35F5",
  pro: "#FBBF24",
  proSoft: "rgba(251, 191, 36, 0.16)",
};
