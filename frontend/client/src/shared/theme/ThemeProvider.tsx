import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { preferencesStorage } from "@/lib/storage";

import { darkColors, lightColors, type ThemeColors, type ThemeScheme } from "./colors";

type AppearancePreference = "light" | "dark" | "system";

const STORAGE_KEY = "sayly.appearance";

type ThemeContextValue = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  scheme: "light",
  colors: lightColors,
  preference: "system",
  setPreference: () => {},
});

function resolveScheme(
  preference: AppearancePreference,
  system: string | null | undefined,
): ThemeScheme {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return system === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>("system");

  useEffect(() => {
    let cancelled = false;

    void preferencesStorage.get(STORAGE_KEY).then((value) => {
      if (cancelled) return;
      if (value === "light" || value === "dark" || value === "system") {
        setPreferenceState(value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    void preferencesStorage.set(STORAGE_KEY, next);
  }, []);

  const scheme = resolveScheme(preference, system);
  const colors = scheme === "dark" ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ scheme, colors, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

export function useThemeScheme(): ThemeScheme {
  return useContext(ThemeContext).scheme;
}
