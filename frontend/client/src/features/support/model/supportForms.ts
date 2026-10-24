import type { IconName } from "@/shared/components/SettingRow";

import type { SupportTicketKind, SupportTopic } from "../api/supportApi";

/** Route param of the SupportForm screen (also the deep link: /support/<kind>). */
export type SupportFormKind = "contact" | "feature" | "bug";

/** Same limits as the backend (features/support/schema.ts). */
const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;

export type SupportFormConfig = {
  ticketKind: SupportTicketKind;
  screenTitle: string;
  icon: IconName;
  heading: string;
  intro: string;
  /** Contact: pick what it's about (same categories as the FAQ). */
  askTopic: boolean;
  subjectLabel: string;
  subjectPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  /** "always": app details are part of every contact message; "optional": member decides. */
  device: "always" | "optional";
  submitLabel: string;
  successTitle: string;
  successMessage: string;
};

export const SUPPORT_FORMS: Record<SupportFormKind, SupportFormConfig> = {
  contact: {
    ticketKind: "CONTACT",
    screenTitle: "Contact us",
    icon: "mail-outline",
    heading: "How can we help?",
    intro: "Tell us what's going on. We usually reply within two working days.",
    askTopic: true,
    subjectLabel: "Subject",
    subjectPlaceholder: "e.g. I can't change my email",
    messageLabel: "Message",
    messagePlaceholder: "Give us as much detail as you can.",
    device: "always",
    submitLabel: "Send message",
    successTitle: "Message sent",
    successMessage: "Thanks for reaching out. We'll reply by email.",
  },
  feature: {
    ticketKind: "FEATURE_REQUEST",
    screenTitle: "Request a feature",
    icon: "bulb-outline",
    heading: "Got an idea?",
    intro: "Tell us what would make Sayly better for you. We read every request.",
    askTopic: false,
    subjectLabel: "Your idea in a few words",
    subjectPlaceholder: "e.g. Voice rooms for beginners",
    messageLabel: "Why would it help you?",
    messagePlaceholder: "Describe how you'd use it and what it would change for you.",
    device: "always",
    submitLabel: "Send idea",
    successTitle: "Thanks for the idea!",
    successMessage: "Your request reached our product team.",
  },
  bug: {
    ticketKind: "BUG_REPORT",
    screenTitle: "Report a bug",
    icon: "bug-outline",
    heading: "Something isn't working?",
    intro: "Tell us what happened and what you expected. Steps to repeat it help a lot.",
    askTopic: false,
    subjectLabel: "What went wrong?",
    subjectPlaceholder: "e.g. The chat freezes when I send a voice message",
    messageLabel: "Details",
    messagePlaceholder: "1. I opened…\n2. I tapped…\n3. Then…",
    device: "optional",
    submitLabel: "Send report",
    successTitle: "Report sent",
    successMessage: "Thanks! Reports like yours help us fix things faster.",
  },
};

export const SUPPORT_TOPIC_OPTIONS: { id: SupportTopic; label: string }[] = [
  { id: "ACCOUNT", label: "Account" },
  { id: "SECURITY", label: "Security" },
  { id: "LANGUAGE_EXCHANGE", label: "Language exchange" },
  { id: "PRO", label: "Sayly Pro" },
  { id: "OTHER", label: "Other" },
];

export type SupportFormValues = { subject: string; message: string };
export type SupportFormErrors = Partial<Record<keyof SupportFormValues, string>>;

/** Mirrors the server: single spaces in the subject, at most one blank line in the message. */
export function normalizeSupportForm(values: SupportFormValues): SupportFormValues {
  return {
    subject: values.subject.replace(/\s+/g, " ").trim(),
    message: values.message
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export function validateSupportForm(values: SupportFormValues): SupportFormErrors {
  const { subject, message } = normalizeSupportForm(values);
  const errors: SupportFormErrors = {};
  if (subject.length < SUBJECT_MIN) {
    errors.subject = `Please write at least ${SUBJECT_MIN} characters.`;
  } else if (subject.length > SUBJECT_MAX) {
    errors.subject = `Keep it under ${SUBJECT_MAX} characters.`;
  }
  if (message.length < MESSAGE_MIN) {
    errors.message = `Please write at least ${MESSAGE_MIN} characters.`;
  } else if (message.length > MESSAGE_MAX) {
    errors.message = `Keep it under ${MESSAGE_MAX} characters.`;
  }
  return errors;
}
