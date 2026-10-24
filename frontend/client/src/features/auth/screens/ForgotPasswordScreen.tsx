import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { toUserFacingAuthMessage, isApiError } from "@/lib/api/errors";
import type { AuthStackParamList } from "@/navigation/types";

import * as authApi from "../api/authApi";
import { backToLogin } from "../authNavigation";
import { authFormStyles } from "../components/authFormStyles";
import { AuthField } from "../components/AuthField";
import { AuthFormShell } from "../components/AuthFormShell";
import { AuthPrimaryButton } from "../components/AuthPrimaryButton";
import { useAuthCopyColors } from "../components/useAuthCopyColors";
import { mapBackendFields, validateEmail } from "../validation";

function formatExpiry(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const copy = useAuthCopyColors();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    setChallengeId(null);
    setExpiresInSeconds(null);
    setCodeSent(false);

    const validationError = validateEmail(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    setEmailError(undefined);
    setIsSubmitting(true);

    try {
      const result = await authApi.requestPasswordReset(email.trim().toLowerCase());
      setCodeSent(true);
      setExpiresInSeconds(result.expiresInSeconds ?? 300);
      setChallengeId(result.challengeId);
    } catch (error) {
      if (isApiError(error) && error.fields?.email) {
        setEmailError(mapBackendFields(error.fields).email);
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
          Forgot password
        </Text>
        <Text style={[authFormStyles.subtitle, { color: copy.subtitle }]}>
          {codeSent
            ? "Enter the 8-digit code from your email to reset your password."
            : "Enter your email and we will send you a reset code."}
        </Text>
      </View>

      {!codeSent ? (
        <AuthField
          tone={copy.tone}
          label="Email"
          labelId="forgotEmailLabel"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setEmailError(undefined);
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={!isSubmitting}
          error={emailError}
        />
      ) : null}

      {formError ? (
        <Text
          style={[authFormStyles.formError, { color: copy.error }]}
          accessibilityLiveRegion="assertive"
        >
          {formError}
        </Text>
      ) : null}

      {codeSent ? (
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
          If an account exists for that email, an 8-digit reset code has been sent. It expires in{" "}
          {formatExpiry(expiresInSeconds ?? 300)}.
        </Text>
      ) : null}

      <AuthPrimaryButton
        label={codeSent ? "Enter reset code" : "Send reset code"}
        loading={isSubmitting}
        onPress={() => {
          if (codeSent) {
            if (!challengeId) {
              setFormError("Reset challenge missing. Request a new code.");
              return;
            }
            navigation.navigate("ResetPassword", {
              challengeId,
              expiresInSeconds: expiresInSeconds ?? undefined,
            });
            return;
          }
          void handleSubmit();
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
        onPress={() => backToLogin(navigation)}
        style={authFormStyles.textLinkWrap}
      >
        <Text style={[authFormStyles.textLink, { color: copy.link }]}>Back to sign in</Text>
      </Pressable>
    </AuthFormShell>
  );
}
