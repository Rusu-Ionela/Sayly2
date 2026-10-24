import React from "react";
import { View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/features/auth";
import { CallProvider } from "@/features/calls";
import { SocketProvider } from "@/features/chat/socket/SocketProvider";
import { API_BASE_URL } from "@/lib/apiClient";
import { log } from "@/lib/logger";
import { queryClient } from "@/lib/queryClient";
import { InAppBannerProvider } from "@/features/notifications";
import { RootNavigator } from "@/navigation/RootNavigator";
import { AmbientBackground } from "@/shared/components/AmbientBackground";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { KeyboardRoot } from "@/shared/keyboard/KeyboardRoot";
import { OfflineBanner } from "@/shared/components/OfflineBanner";
import { ThemeProvider, useThemeScheme } from "@/shared/theme";

log.info("app", "starting", { apiBaseUrl: API_BASE_URL });

export function Main() {
  return (
    <SafeAreaProvider>
      <KeyboardRoot>
        <ThemeProvider>
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
        </ThemeProvider>
      </KeyboardRoot>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const scheme = useThemeScheme();

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <View style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SocketProvider>
              <CallProvider>
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                <OfflineBanner />
                <InAppBannerProvider>
                  <RootNavigator />
                </InAppBannerProvider>
              </CallProvider>
            </SocketProvider>
          </AuthProvider>
        </QueryClientProvider>
      </View>
    </View>
  );
}
