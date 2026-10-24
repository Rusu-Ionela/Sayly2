import { type ReactNode } from "react";
import { ScrollView } from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";

import { AuthBackdrop } from "./AuthBackdrop";
import { AuthCloseButton } from "./AuthCloseButton";
import { authFormStyles } from "./authFormStyles";

type AuthFormShellProps = {
  children: ReactNode;
  onClose: () => void;
};

/** Checkerboard auth layout shared by login, signup, and password reset screens. */
export function AuthFormShell({ children, onClose }: AuthFormShellProps) {
  return (
    <AuthBackdrop>
      <AuthCloseButton onPress={onClose} />
      <KeyboardSafeView style={authFormStyles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={authFormStyles.scrollContent}
          bounces={false}
        >
          {children}
        </ScrollView>
      </KeyboardSafeView>
    </AuthBackdrop>
  );
}
