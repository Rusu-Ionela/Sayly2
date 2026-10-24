import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "@/features/auth";
import { preloadWelcomeAssets } from "@/features/auth/welcomeAssets";
import { OnboardingScreen, useCurrentUser } from "@/features/onboarding";
import { SplashScreen } from "@/features/splash";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { WarmLoadingView } from "@/shared/components/WarmLoadingView";
import { navigationThemeFor, useColors, useThemeScheme } from "@/shared/theme";

import { navigationRef } from "./navigationRef";
import { AuthNavigator } from "./AuthNavigator";
import { rootLinking } from "./linking";
import { MainNavigator } from "./MainNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isSignedIn, isInitialized } = useAuth();
  const colors = useColors();
  const scheme = useThemeScheme();
  const [splashDone, setSplashDone] = useState(false);
  const [welcomeAssetsReady, setWelcomeAssetsReady] = useState(false);
  const meQuery = useCurrentUser(isSignedIn && splashDone);
  const onboardingCompleted = meQuery.data?.onboardingCompleted === true;

  useEffect(() => {
    let cancelled = false;

    void preloadWelcomeAssets().finally(() => {
      if (!cancelled) {
        setWelcomeAssetsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  const splashReady = isInitialized && welcomeAssetsReady;

  if (!splashDone) {
    return <SplashScreen isReady={splashReady} onComplete={handleSplashComplete} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={rootLinking}
      theme={navigationThemeFor(scheme, colors)}
    >
      {isSignedIn && meQuery.isLoading ? (
        <View style={styles.loading}>
          <WarmLoadingView
            accessibilityLabel="Loading your account"
            status="Loading your account..."
          />
        </View>
      ) : isSignedIn && meQuery.isError && !meQuery.data ? (
        <View style={styles.loading}>
          <WarmErrorState
            title="Could not load your account"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => {
              void meQuery.refetch();
            }}
          />
        </View>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
          {isSignedIn ? (
            onboardingCompleted ? (
              <Stack.Screen name="App" component={MainNavigator} />
            ) : (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )
          ) : (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
