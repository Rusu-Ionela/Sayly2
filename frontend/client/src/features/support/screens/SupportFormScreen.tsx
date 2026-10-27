import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { useProfile } from "@/features/profile/hooks/useProfile";
import type { AppStackParamList } from "@/navigation/types";
import { Button } from "@/shared/components/Button";
import { Chip } from "@/shared/components/Chip";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { SettingRow } from "@/shared/components/SettingRow";
import { TextField } from "@/shared/components/TextField";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { SUPPORT_MESSAGE_MAX, SUPPORT_SUBJECT_MAX, type SupportTopic } from "@sayly/shared";

import { SupportIntro } from "../components/SupportIntro";
import { supportErrorMessage, useSubmitSupportTicket } from "../hooks/useSubmitSupportTicket";
import { currentDeviceContext, describeDeviceContext } from "../model/deviceContext";
import {
  SUPPORT_FORMS,
  SUPPORT_TOPIC_OPTIONS,
  normalizeSupportForm,
  validateSupportForm,
  type SupportFormErrors,
} from "../model/supportForms";

/** Contact us, Request a feature and Report a bug: one form, configured by `kind`. */
export function SupportFormScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<AppStackParamList, "SupportForm">>();
  // Deep links (/support/<kind>) can carry anything; unknown kinds open "Contact us".
  const config = Object.prototype.hasOwnProperty.call(SUPPORT_FORMS, params.kind)
    ? SUPPORT_FORMS[params.kind]
    : SUPPORT_FORMS.contact;
  const email = useProfile().data?.email;
  const submit = useSubmitSupportTicket();
  const device = useMemo(() => currentDeviceContext(), []);

  const [topic, setTopic] = useState<SupportTopic | undefined>(params.topic);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachDevice, setAttachDevice] = useState(true);
  const [errors, setErrors] = useState<SupportFormErrors>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: config.screenTitle });
  }, [config.screenTitle, navigation]);

  const send = () => {
    const nextErrors = validateSupportForm({ subject, message });
    setErrors(nextErrors);
    if (nextErrors.subject || nextErrors.message) return;

    const values = normalizeSupportForm({ subject, message });
    const includeDevice = config.device === "always" || attachDevice;
    submit.mutate(
      {
        kind: config.ticketKind,
        topic: config.askTopic ? (topic ?? "OTHER") : undefined,
        ...values,
        device: includeDevice ? device : undefined,
      },
      {
        onSuccess: (ticket) =>
          Alert.alert(
            config.successTitle,
            `${config.successMessage}${ticket.contactEmail ? `\n\nWe'll reply to ${ticket.contactEmail}.` : ""}`,
            [{ text: "Done", onPress: () => navigation.goBack() }],
          ),
        onError: (error) => Alert.alert("Could not send", supportErrorMessage(error)),
      },
    );
  };

  return (
    <Screen includeBottomInset>
      <KeyboardSafeView>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SupportIntro icon={config.icon} heading={config.heading} body={config.intro} />

          {config.askTopic ? (
            <View style={styles.group}>
              <Text style={[styles.label, { color: colors.text }]}>What is it about?</Text>
              <View style={styles.chips}>
                {SUPPORT_TOPIC_OPTIONS.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    selected={topic === option.id}
                    onPress={() => setTopic(option.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <TextField
            label={config.subjectLabel}
            placeholder={config.subjectPlaceholder}
            value={subject}
            onChangeText={(next) => {
              setSubject(next);
              if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
            }}
            maxLength={SUPPORT_SUBJECT_MAX}
            error={errors.subject}
            returnKeyType="next"
          />

          <TextField
            label={config.messageLabel}
            placeholder={config.messagePlaceholder}
            value={message}
            onChangeText={(next) => {
              setMessage(next);
              if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
            }}
            maxLength={SUPPORT_MESSAGE_MAX}
            showCounter
            multiline
            error={errors.message}
          />

          {config.device === "optional" ? (
            <SectionCard footer={attachDevice ? describeDeviceContext(device) : undefined}>
              <SettingRow
                kind="toggle"
                icon="phone-portrait-outline"
                title="Attach app & device details"
                subtitle="Helps us reproduce the problem"
                value={attachDevice}
                onValueChange={setAttachDevice}
              />
            </SectionCard>
          ) : null}

          <Text style={[styles.note, { color: colors.muted }]}>
            {[
              email ? `We'll reply to ${email}.` : null,
              config.device === "always"
                ? `Sent with your account and app details (${describeDeviceContext(device)}).`
                : "Sent with your account details.",
            ]
              .filter(Boolean)
              .join(" ")}
          </Text>

          <Button label={config.submitLabel} onPress={send} loading={submit.isPending} />
        </ScrollView>
      </KeyboardSafeView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  group: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  label: {
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    marginVertical: spacing.sm,
  },
});
