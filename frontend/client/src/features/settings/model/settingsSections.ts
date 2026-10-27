import type { ToggleSettingKey } from "@/features/profile/types";
import { COMMUNITY_LINKS } from "@/features/support/model/supportLinks";
import type { IconName } from "@/shared/components/SettingRow";

/** Every non-toggle row resolves to one of these; the screen maps each to a handler. */
export type SettingsAction =
  | "rateUs"
  | "reportBug"
  | "requestFeature"
  | "communityGuidelines"
  | "partyGuidelines"
  | "faq"
  | "contactUs"
  | "aboutUs"
  | "termsOfService"
  | "privacyPolicy"
  | "imprint"
  | "jobs"
  | "blockedUsers"
  | "subscription"
  | "changePassword"
  | "downloadData"
  | "deleteAccount";

type SettingsItem =
  | { kind: "toggle"; key: ToggleSettingKey; title: string; subtitle?: string; icon: IconName }
  | {
      kind: "link";
      action: SettingsAction;
      title: string;
      subtitle?: string;
      icon: IconName;
      tone?: "danger";
    }
  /** Opens a web page outside the app (blog, social channels). */
  | { kind: "external"; id: string; url: string; title: string; subtitle?: string; icon: IconName };

export type SettingsSection =
  | { id: string; kind?: "rows"; title: string; footer?: string; items: SettingsItem[] }
  /** Light / Dark / Auto segmented control. */
  | { id: string; kind: "appearance"; title: string };

/**
 * Below the profile menu on the Profile tab, top to bottom: feedback, help, community
 * links, legal and the privacy toggles; Sign out is rendered last, on its own.
 * "Show me in the Community" lives in the profile header, so it isn't repeated here.
 */
export const PROFILE_SECTIONS: SettingsSection[] = [
  {
    id: "feedback",
    title: "Rating & feedback",
    footer: "Every idea and report is read by the Sayly team.",
    items: [
      { kind: "link", action: "rateUs", icon: "star-outline", title: "Make our day and rate us" },
      {
        kind: "link",
        action: "reportBug",
        icon: "bug-outline",
        title: "Report a bug",
        subtitle: "Tell us what went wrong",
      },
      {
        kind: "link",
        action: "requestFeature",
        icon: "bulb-outline",
        title: "Request a feature",
        subtitle: "Share an idea that would help you",
      },
    ],
  },
  {
    id: "help",
    title: "Guidelines & support",
    items: [
      {
        kind: "link",
        action: "communityGuidelines",
        icon: "document-text-outline",
        title: "Community guidelines",
      },
      {
        kind: "link",
        action: "partyGuidelines",
        icon: "mic-outline",
        title: "Language Parties guidelines",
      },
      { kind: "link", action: "faq", icon: "help-circle-outline", title: "FAQ" },
      {
        kind: "link",
        action: "contactUs",
        icon: "mail-outline",
        title: "Contact us",
        subtitle: "We usually reply within two working days",
      },
    ],
  },
  {
    id: "community",
    title: "Sayly community",
    items: COMMUNITY_LINKS.map((link) => ({ kind: "external" as const, ...link })),
  },
  {
    id: "legal",
    title: "Legal & info",
    items: [
      { kind: "link", action: "aboutUs", icon: "information-circle-outline", title: "About us" },
      {
        kind: "link",
        action: "termsOfService",
        icon: "reader-outline",
        title: "Terms of Service",
      },
      {
        kind: "link",
        action: "privacyPolicy",
        icon: "lock-closed-outline",
        title: "Privacy Policy",
      },
      { kind: "link", action: "imprint", icon: "business-outline", title: "Imprint" },
      { kind: "link", action: "jobs", icon: "briefcase-outline", title: "Jobs" },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    items: [
      {
        kind: "toggle",
        key: "showSaylyId",
        icon: "qr-code-outline",
        title: "Show my Sayly ID",
        subtitle: "Needed to share your profile. When off, shared links stop working.",
      },
      {
        kind: "toggle",
        key: "showOnlineStatus",
        icon: "radio-button-on-outline",
        title: "Show online status",
        subtitle: "Others see when you are online or last active.",
      },
      {
        kind: "toggle",
        key: "showLocation",
        icon: "location-outline",
        title: "Show location",
        subtitle: "Your country and city on your profile and in Discover.",
      },
    ],
  },
];

/** The Settings screen (gear on the Profile tab): notifications, appearance, safety, account. */
export const SETTINGS_SCREEN_SECTIONS: SettingsSection[] = [
  {
    id: "notifications",
    title: "Notifications",
    footer: "Saved to your account on every device.",
    items: [
      { kind: "toggle", key: "notifyMessages", icon: "chatbubble-outline", title: "Messages" },
      {
        kind: "toggle",
        key: "notifyGroupActivity",
        icon: "people-outline",
        title: "Group activity",
      },
      {
        kind: "toggle",
        key: "notifyStreakReminders",
        icon: "flame-outline",
        title: "Streak reminders",
      },
    ],
  },
  { id: "appearance", kind: "appearance", title: "Appearance" },
  {
    id: "safety",
    title: "Safety",
    items: [
      {
        kind: "link",
        action: "blockedUsers",
        icon: "hand-left-outline",
        title: "Blocked",
        subtitle: "People who can't see or message you",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      { kind: "link", action: "subscription", icon: "diamond-outline", title: "Sayly Pro" },
      { kind: "link", action: "changePassword", icon: "key-outline", title: "Change password" },
      {
        kind: "link",
        action: "downloadData",
        icon: "download-outline",
        title: "Download my data",
        subtitle: "A copy of everything Sayly keeps about you",
      },
      {
        kind: "link",
        action: "deleteAccount",
        icon: "trash-outline",
        title: "Delete account",
        subtitle: "Removes your profile, photos and certificates",
        tone: "danger",
      },
    ],
  },
];
