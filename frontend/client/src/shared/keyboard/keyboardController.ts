import { Platform, TurboModuleRegistry } from "react-native";

type KeyboardControllerModule = typeof import("react-native-keyboard-controller");

/**
 * react-native-keyboard-controller handles the keyboard correctly on Android edge-to-edge,
 * where React Native's own KeyboardAvoidingView misjudges the keyboard position. It is
 * used on Android only (iOS works with the built-in one), and only when the native module
 * is present in this build — otherwise the app keeps the built-in behaviour.
 */
export const keyboardController: KeyboardControllerModule | null = (() => {
  if (Platform.OS !== "android") return null;
  if (!TurboModuleRegistry.get("KeyboardController")) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-keyboard-controller") as KeyboardControllerModule;
})();
