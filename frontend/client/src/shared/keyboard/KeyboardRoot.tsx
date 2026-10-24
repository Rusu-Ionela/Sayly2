import { type ReactNode } from "react";

import { keyboardController } from "./keyboardController";

/** Mounts the keyboard-controller provider (Android edge-to-edge) when it is available. */
export function KeyboardRoot({ children }: { children: ReactNode }) {
  if (!keyboardController) return <>{children}</>;
  const { KeyboardProvider } = keyboardController;
  return (
    // Expo apps run edge-to-edge on Android: status and navigation bars are translucent.
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      {children}
    </KeyboardProvider>
  );
}
