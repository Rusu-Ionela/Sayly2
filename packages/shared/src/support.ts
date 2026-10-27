import { z } from "zod";

import { multilineTextSchema, singleLineTextSchema } from "./validation";

export const SUPPORT_TICKET_KINDS = ["CONTACT", "FEATURE_REQUEST", "BUG_REPORT"] as const;
export type SupportTicketKind = (typeof SUPPORT_TICKET_KINDS)[number];

/** FAQ / contact categories. */
export const SUPPORT_TOPICS = ["ACCOUNT", "SECURITY", "LANGUAGE_EXCHANGE", "PRO", "OTHER"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const DEVICE_PLATFORMS = ["IOS", "ANDROID", "WEB"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 4000;

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

const shortText = (max: number, label: string) => singleLineTextSchema(1, max, label);

const deviceContextSchema = z
  .object({
    appVersion: shortText(32, "App version"),
    platform: z.enum(DEVICE_PLATFORMS),
    osVersion: shortText(32, "OS version").optional(),
    deviceModel: shortText(80, "Device model").optional(),
  })
  .strict();

/** POST /support/tickets — strict, so a client can't set userId, email or status. */
export const createSupportTicketSchema = z
  .object({
    kind: z.enum(SUPPORT_TICKET_KINDS),
    topic: z.enum(SUPPORT_TOPICS).optional(),
    subject: singleLineTextSchema(SUPPORT_SUBJECT_MIN, SUPPORT_SUBJECT_MAX, "Subject"),
    message: multilineTextSchema(SUPPORT_MESSAGE_MAX, "Message").pipe(
      z
        .string()
        .min(SUPPORT_MESSAGE_MIN, `Message must be at least ${SUPPORT_MESSAGE_MIN} characters`),
    ),
    device: deviceContextSchema.optional(),
  })
  .strict() satisfies z.ZodType<CreateSupportTicketInput>;

/** POST /support/bug-report and /support/feature-request — the route sets the kind. */
export const createFeedbackSchema = createSupportTicketSchema.omit({
  kind: true,
  topic: true,
});
