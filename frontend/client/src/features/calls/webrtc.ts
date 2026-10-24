import Constants, { ExecutionEnvironment } from "expo-constants";
import { PermissionsAndroid, Platform } from "react-native";

import type { CallKind } from "./callState";

type WebRtcModule = typeof import("react-native-webrtc");

let cached: WebRtcModule | null | undefined;

/**
 * react-native-webrtc is a native module: it exists only in a custom dev build / store build.
 * Expo Go reports a missing native module as an uncaught error even inside try/catch, so we
 * must not require the package there. On web it does not exist either.
 */
export function getWebRtc(): WebRtcModule | null {
  if (cached !== undefined) return cached;
  if (
    Platform.OS === "web" ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("react-native-webrtc") as WebRtcModule;
  } catch {
    cached = null;
  }
  return cached;
}

export const CALLS_UNSUPPORTED_MESSAGE =
  "Calls need the installed Sayly app. They don’t work in Expo Go or on the web.";

/** Android needs a runtime prompt; iOS prompts itself from the Info.plist text on first capture. */
export async function ensureCallPermissions(kind: CallKind) {
  if (Platform.OS !== "android") return;
  const wanted =
    kind === "VIDEO"
      ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA]
      : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  if (wanted.some((permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error(
      kind === "VIDEO"
        ? "Allow camera and microphone access in Settings to make video calls."
        : "Allow microphone access in Settings to make calls.",
    );
  }
}
