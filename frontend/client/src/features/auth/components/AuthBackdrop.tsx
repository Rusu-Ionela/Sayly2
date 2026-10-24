import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MosaicBackdrop } from "@/features/splash/SplashBackdrop";
import { useColors, useThemeScheme } from "@/shared/theme";

type AuthBackdropProps = {
  children: ReactNode;
};

/** Shared shell: mosaic background used across splash-adjacent auth screens. */
export function AuthBackdrop({ children }: AuthBackdropProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const scheme = useThemeScheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <MosaicBackdrop focusHalo={false} />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
});
