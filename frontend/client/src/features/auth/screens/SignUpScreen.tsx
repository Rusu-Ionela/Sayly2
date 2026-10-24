import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";

import { isApiError, toUserFacingAuthMessage } from "@/lib/api/errors";
import type { AuthStackParamList } from "@/navigation/types";

import { useAuth } from "../AuthProvider";
import { resetToWelcome, switchToLogin } from "../authNavigation";
import { AuthBackdrop } from "../components/AuthBackdrop";
import { AuthCloseButton } from "../components/AuthCloseButton";
import { AuthField } from "../components/AuthField";
import { AuthPrimaryButton } from "../components/AuthPrimaryButton";
import { useAuthCopyColors } from "../components/useAuthCopyColors";
import {
  hasFieldErrors,
  mapBackendFields,
  passwordRules,
  validateRegisterForm,
  type FieldErrors,
} from "../validation";

function provisionalDisplayName(email: string): string {
  const local =
    email
      .trim()
      .split("@")[0]
      ?.replace(/[^A-Za-z0-9]/g, "") ?? "";
  const name = local.slice(0, 50);
  return name.length >= 2 ? name : "Member";
}

export function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp, isLoading } = useAuth();
  const copy = useAuthCopyColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFieldErrors({});
    setFormError(null);

    if (!agreedToTerms) {
      setFormError("Please agree to the Privacy Policy and Terms of Service to continue.");
      return;
    }

    const errors = validateRegisterForm({ email, password });
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      return;
    }

    try {
      await signUp({
        displayName: provisionalDisplayName(email),
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
              Create a new account
            </Text>
          </View>

          <AuthField
            tone={copy.tone}
            label="Email"
            labelId="signupEmailLabel"
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
            labelId="signupPasswordLabel"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!isLoading}
            error={fieldErrors.password}
          />

          <View style={styles.rules}>
            {passwordRules(password).map((rule) => (
              <Text
                key={rule.label}
                style={[styles.rule, { color: rule.ok ? "#22C55E" : copy.muted }]}
              >
                {rule.ok ? "✓" : "○"} {rule.label}
              </Text>
            ))}
          </View>

          <Pressable
            style={styles.consentRow}
            onPress={() => {
              setAgreedToTerms((prev) => !prev);
              setFormError(null);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreedToTerms }}
            accessibilityLabel="I have read and agree to Privacy Policy and Terms of Service"
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: copy.link,
                  backgroundColor: agreedToTerms ? copy.link : "transparent",
                },
              ]}
            >
              {agreedToTerms ? (
                <Text style={[styles.checkboxMark, { color: copy.title }]}>✓</Text>
              ) : null}
            </View>
            <Text style={[styles.legal, { color: copy.subtitle, textAlign: "left", flex: 1 }]}>
              I have read and agree to{" "}
              <Text
                style={[styles.legalLink, { color: copy.link }]}
                onPress={() => navigation.navigate("PrivacyPolicy")}
                accessibilityRole="link"
              >
                Privacy Policy
              </Text>{" "}
              and{" "}
              <Text
                style={[styles.legalLink, { color: copy.link }]}
                onPress={() => navigation.navigate("TermsOfService")}
                accessibilityRole="link"
              >
                Terms of Service
              </Text>
              .
            </Text>
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
            label="Continue"
            loading={isLoading}
            onPress={() => {
              void handleSubmit();
            }}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerMuted, { color: copy.muted }]}>
              Already have an account?{" "}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log in"
              onPress={() => switchToLogin(navigation)}
              hitSlop={8}
            >
              <Text style={[styles.footerLink, { color: copy.link }]}>Log in</Text>
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
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  legal: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },
  legalLink: {
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxMark: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  rules: {
    gap: 6,
    marginTop: -4,
    marginBottom: 16,
  },
  rule: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
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
