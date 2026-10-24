export const SUPPORT_TICKET_KINDS = ["CONTACT", "FEATURE_REQUEST", "BUG_REPORT"] as const;
export type SupportTicketKind = (typeof SUPPORT_TICKET_KINDS)[number];

/** FAQ / contact categories. */
export const SUPPORT_TOPICS = ["ACCOUNT", "SECURITY", "LANGUAGE_EXCHANGE", "PRO", "OTHER"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const DEVICE_PLATFORMS = ["IOS", "ANDROID", "WEB"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

/** App and device details the member chose to attach (helps support reproduce bugs). */
export type DeviceContext = {
  appVersion: string;
  platform: DevicePlatform;
  osVersion?: string;
  deviceModel?: string;
};

/** Body of POST /support/tickets. Who sent it and their email come from the session. */
export type CreateSupportTicketInput = {
  kind: SupportTicketKind;
  topic?: SupportTopic;
  subject: string;
  message: string;
  device?: DeviceContext;
};

export type SupportTicketDto = {
  id: string;
  kind: SupportTicketKind;
  topic: SupportTopic | null;
  subject: string;
  status: SupportTicketStatus;
  /** Where support will reply. */
  contactEmail: string;
  createdAt: string;
};
