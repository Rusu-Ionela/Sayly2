import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";

import { isApiError, toUserFacingAuthMessage } from "@/lib/api/errors";
import type { AuthStackParamList } from "@/navigation/types";

import * as authApi from "../api/authApi";
import { backToLogin } from "../authNavigation";
import { authFormStyles } from "../components/authFormStyles";
import { AuthField } from "../components/AuthField";
import { AuthFormShell } from "../components/AuthFormShell";
import { AuthPrimaryButton } from "../components/AuthPrimaryButton";
import { useAuthCopyColors } from "../components/useAuthCopyColors";
import {
  mapBackendFields,
  passwordRules,
  validateRegisterPassword,
  validateResetToken,
} from "../validation";

function formatExpiry(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function ResetPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, "ResetPassword">>();
  const copy = useAuthCopyColors();
  const [code, setCode] = useState(route.params?.code ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expiresLabel = formatExpiry(route.params?.expiresInSeconds ?? 300);

  const handleSubmit = async () => {
    setFormError(null);
    setInfoMessage(null);

    const nextCodeError = validateResetToken(code);
    const nextPasswordError = validateRegisterPassword(password);
    let nextConfirmPasswordError: string | undefined;

    if (!confirmPassword) {
      nextConfirmPasswordError = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      nextConfirmPasswordError = "Passwords do not match.";
    }

    setCodeError(nextCodeError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);

    if (nextCodeError || nextPasswordError || nextConfirmPasswordError) {
      return;
    }

    const challengeId = route.params?.challengeId;
    if (!challengeId) {
      setFormError("Request a new reset code first.");
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.resetPassword({
        challengeId,
        token: code.trim(),
        password,
      });
      setInfoMessage("Password updated. Taking you to sign in…");
      setTimeout(() => {
        backToLogin(navigation);
      }, 900);
    } catch (error) {
      if (isApiError(error) && error.fields) {
        const mapped = mapBackendFields(error.fields);
        if (mapped.token) setCodeError(mapped.token);
        if (mapped.password) setPasswordError(mapped.password);
        if (mapped.challengeId) {
          setFormError(mapped.challengeId);
        } else if (!mapped.token && !mapped.password) {
          setFormError(toUserFacingAuthMessage(error));
        }
      } else {
        setFormError(toUserFacingAuthMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthFormShell onClose={() => backToLogin(navigation)}>
      <View style={authFormStyles.header}>
        <Text style={[authFormStyles.title, { color: copy.title }]} accessibilityRole="header">
          Reset password
        </Text>
        <Text style={[authFormStyles.subtitle, { color: copy.subtitle }]}>
          Enter the 8-digit code and choose a new password. Codes expire in {expiresLabel}.
        </Text>
      </View>

      <AuthField
        tone={copy.tone}
        label="Reset code"
        labelId="resetCodeLabel"
        value={code}
        onChangeText={(value) => {
          setCode(value.replace(/\D/g, "").slice(0, 6));
          setCodeError(undefined);
        }}
        placeholder="000000"
        keyboardType="number-pad"
        inputMode="numeric"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={8}
        editable={!isSubmitting}
        error={codeError}
      />

      <AuthField
        tone={copy.tone}
        label="New password"
        labelId="resetPasswordLabel"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setPasswordError(undefined);
        }}
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        editable={!isSubmitting}
        error={passwordError}
      />
      <View style={{ gap: 6, marginBottom: 12 }}>
        {passwordRules(password).map((rule) => (
          <Text
            key={rule.label}
            style={{ color: rule.ok ? "#22C55E" : copy.muted, fontSize: 14, fontWeight: "600" }}
          >
            {rule.ok ? "✓" : "○"} {rule.label}
          </Text>
        ))}
      </View>

      <AuthField
        tone={copy.tone}
        label="Confirm password"
        labelId="resetConfirmPasswordLabel"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          setConfirmPasswordError(undefined);
        }}
        placeholder="Repeat new password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        editable={!isSubmitting}
        error={confirmPasswordError}
      />

      {formError ? (
        <Text
          style={[authFormStyles.formError, { color: copy.error }]}
          accessibilityLiveRegion="assertive"
        >
          {formError}
        </Text>
      ) : null}

      {infoMessage ? (
        <Text
          style={[
            authFormStyles.infoBanner,
            {
              color: copy.bannerText,
              backgroundColor: copy.bannerBg,
              borderColor: copy.bannerBorder,
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          {infoMessage}
        </Text>
      ) : null}

      <AuthPrimaryButton
        label={infoMessage ? "Back to sign in" : "Update password"}
        loading={isSubmitting}
        onPress={() => {
          if (infoMessage) {
            backToLogin(navigation);
            return;
          }
          void handleSubmit();
        }}
      />

      {!infoMessage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request a new code"
          onPress={() => navigation.replace("ForgotPassword")}
          style={authFormStyles.textLinkWrap}
        >
          <Text style={[authFormStyles.textLink, { color: copy.link }]}>Request a new code</Text>
        </Pressable>
      ) : null}
    </AuthFormShell>
  );
}
