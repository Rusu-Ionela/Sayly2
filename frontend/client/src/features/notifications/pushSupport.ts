import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

export type PushSupport =
  | { supported: true; projectId: string }
  | { supported: false; reason: "web" | "simulator" | "expo-go-android" | "no-project-id" };

function easProjectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  return fromExtra ?? Constants.easConfig?.projectId ?? undefined;
}

/**
 * Whether this build can receive remote push notifications:
 * - not on web or simulators;
 * - not in Expo Go on Android (removed there since SDK 53 — use a development build);
 * - the app needs an EAS project id (`eas init`) to get an Expo push token.
 */
export function pushSupport(): PushSupport {
  if (Platform.OS === "web") return { supported: false, reason: "web" };
  if (!Device.isDevice) return { supported: false, reason: "simulator" };
  if (
    Platform.OS === "android" &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return { supported: false, reason: "expo-go-android" };
  }
  const projectId = easProjectId();
  if (!projectId) return { supported: false, reason: "no-project-id" };
  return { supported: true, projectId };
}
