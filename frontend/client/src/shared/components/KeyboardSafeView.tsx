import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from "react-native";

import { keyboardController } from "@/shared/keyboard/keyboardController";

type KeyboardSafeViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Keeps the focused field above the keyboard — the one rule for every form, screen and
 * bottom sheet.
 *
 * - Android: react-native-keyboard-controller with `automaticOffset`, which finds the
 *   view's real position on screen. React Native's own KeyboardAvoidingView misjudges the
 *   keyboard on edge-to-edge Android and left the chat composer under the suggestion bar.
 * - iOS (and Android builds without that native module): the built-in view, told how far
 *   from the top of the window it starts (status bar, header, safe area), measured here.
 */
export function KeyboardSafeView({ children, style }: KeyboardSafeViewProps) {
  if (keyboardController) {
    const ControllerAvoidingView = keyboardController.KeyboardAvoidingView;
    return (
      <ControllerAvoidingView behavior="padding" automaticOffset style={[{ flex: 1 }, style]}>
        {children}
      </ControllerAvoidingView>
    );
  }
  return <MeasuredKeyboardAvoidingView style={style}>{children}</MeasuredKeyboardAvoidingView>;
}

function MeasuredKeyboardAvoidingView({ children, style }: KeyboardSafeViewProps) {
  const ref = useRef<ViewInstance>(null);
  const [topInWindow, setTopInWindow] = useState(0);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => {
      const top = Math.max(0, Math.round(y));
      setTopInWindow((previous) => (previous === top ? previous : top));
    });
  }, []);

  return (
    <View ref={ref} style={{ flex: 1 }} onLayout={measure} collapsable={false}>
      <KeyboardAvoidingView
        style={[{ flex: 1 }, style]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={topInWindow}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}
