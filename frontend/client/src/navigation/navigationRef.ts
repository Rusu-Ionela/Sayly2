import { createNavigationContainerRef } from "@react-navigation/native";

import type { AppStackParamList, RootStackParamList } from "./types";

/** Lets code outside screens (notification taps, banners) navigate. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Opens a screen of the signed-in app; ignored while signed out or not mounted yet. */
export function navigateInApp<Name extends keyof AppStackParamList>(
  ...args: undefined extends AppStackParamList[Name]
    ? [screen: Name, params?: AppStackParamList[Name]]
    : [screen: Name, params: AppStackParamList[Name]]
) {
  if (!navigationRef.isReady()) return;
  const [screen, params] = args;
  navigationRef.navigate("App", { screen, params } as never);
}

/** The deepest focused route, e.g. to skip a banner for the chat already open. */
export function currentRoute() {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
}
