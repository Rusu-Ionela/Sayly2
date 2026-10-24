import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

import {
  MESSAGE_MAX,
  MESSAGE_MIN,
  SUBJECT_MAX,
  SUBJECT_MIN,
} from "../../features/support/schema";
import {
  DEVICE_PLATFORMS,
  SUPPORT_TICKET_KINDS,
  SUPPORT_TOPICS,
} from "../../features/support/types";

extendZodWithOpenApi(z);

export const CreateSupportTicketRequestSchema = z
  .object({
    kind: z.enum(SUPPORT_TICKET_KINDS),
    topic: z.enum(SUPPORT_TOPICS).optional(),
    subject: z.string().min(SUBJECT_MIN).max(SUBJECT_MAX).openapi({ example: "Dark mode for chat" }),
    message: z.string().min(MESSAGE_MIN).max(MESSAGE_MAX),
    device: z
      .object({
        appVersion: z.string().max(32).openapi({ example: "1.0.0" }),
        platform: z.enum(DEVICE_PLATFORMS),
        osVersion: z.string().max(32).optional(),
        deviceModel: z.string().max(80).optional(),
      })
      .optional()
      .openapi({ description: "Attached only when the member agrees" }),
  })
  .openapi("CreateSupportTicketRequest", {
    description: "The sender and their reply email come from the session, never the body.",
  });

export const CreateFeedbackRequestSchema = CreateSupportTicketRequestSchema.omit({
  kind: true,
  topic: true,
}).openapi("CreateFeedbackRequest", { description: "The route sets the kind." });

export const SupportTicketSchema = z
  .object({
    id: z.string(),
    kind: z.enum(SUPPORT_TICKET_KINDS),
    topic: z.enum(SUPPORT_TOPICS).nullable(),
    subject: z.string(),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    contactEmail: z.string(),
    createdAt: z.string(),
  })
  .openapi("SupportTicket");

export const SupportTicketListSchema = z
  .object({ items: z.array(SupportTicketSchema) })
  .openapi("SupportTicketList");
