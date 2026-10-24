import { z } from "zod";

import { multilineTextSchema, singleLineTextSchema } from "../../shared/validation/text";

import {
  DEVICE_PLATFORMS,
  SUPPORT_TICKET_KINDS,
  SUPPORT_TOPICS,
  type CreateSupportTicketInput,
} from "./types";

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;

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
    subject: singleLineTextSchema(SUBJECT_MIN, SUBJECT_MAX, "Subject"),
    message: multilineTextSchema(MESSAGE_MAX, "Message").pipe(
      z.string().min(MESSAGE_MIN, `Message must be at least ${MESSAGE_MIN} characters`),
    ),
    device: deviceContextSchema.optional(),
  })
  .strict() satisfies z.ZodType<CreateSupportTicketInput>;

/** POST /support/bug-report and /support/feature-request — the route sets the kind. */
export const createFeedbackSchema = createSupportTicketSchema.omit({ kind: true, topic: true });
