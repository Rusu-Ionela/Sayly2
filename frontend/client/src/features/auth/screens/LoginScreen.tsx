import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";

import { isApiError, toUserFacingAuthMessage } from "@/lib/api/errors";
import type { AuthStackParamList } from "@/navigation/types";

import { useAuth } from "../AuthProvider";
import { resetToWelcome, switchToSignUp } from "../authNavigation";
import { AuthBackdrop } from "../components/AuthBackdrop";
import { AuthCloseButton } from "../components/AuthCloseButton";
import { AuthField } from "../components/AuthField";
import { AuthPrimaryButton } from "../components/AuthPrimaryButton";
import { useAuthCopyColors } from "../components/useAuthCopyColors";
import {
  hasFieldErrors,
  mapBackendFields,
  validateLoginForm,
  type FieldErrors,
} from "../validation";

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn, isLoading } = useAuth();
  const copy = useAuthCopyColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFieldErrors({});
    setFormError(null);

    const errors = validateLoginForm({ email, password });
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      return;
    }

    try {
      await signIn({
        email: email.trim(),
        password,
      });
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        setFieldErrors(mapBackendFields(error.fields));
        setFormError(toUserFacingAuthMessage(error));
        return;
      }
      setFormError(toUserFacingAuthMessage(error));
    }
  };

  return (
    <AuthBackdrop>
      <AuthCloseButton onPress={() => resetToWelcome(navigation)} />

      <KeyboardSafeView style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: copy.title }]} accessibilityRole="header">
              Welcome back!
            </Text>
            <Text style={[styles.subtitle, { color: copy.subtitle }]}>
              Log in with your email and password.
            </Text>
          </View>

          <AuthField
            tone={copy.tone}
            label="Email"
            labelId="loginEmailLabel"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!isLoading}
            error={fieldErrors.email}
          />

          <AuthField
            tone={copy.tone}
            label="Password"
            labelId="loginPasswordLabel"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            editable={!isLoading}
            error={fieldErrors.password}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            disabled={isLoading}
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.forgotWrap}
          >
            <Text style={[styles.forgotLink, { color: copy.link }]}>Forgot password?</Text>
          </Pressable>

          {formError ? (
            <Text
              style={[styles.formError, { color: copy.error }]}
              accessibilityLiveRegion="assertive"
            >
              {formError}
            </Text>
          ) : null}

          <AuthPrimaryButton
            label="Log in"
            loading={isLoading}
            onPress={() => {
              void handleSubmit();
            }}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerMuted, { color: copy.muted }]}>Don’t have an account? </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new account"
              onPress={() => switchToSignUp(navigation)}
              hitSlop={8}
            >
              <Text style={[styles.footerLink, { color: copy.link }]}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 16,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  forgotWrap: {
    alignSelf: "flex-end",
    minHeight: 40,
    justifyContent: "center",
    marginTop: -8,
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: "600",
  },
  formError: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
    lineHeight: 18,
  },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  footerMuted: {
    fontSize: 15,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: "700",
  },
});
