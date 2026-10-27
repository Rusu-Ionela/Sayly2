import { z } from "zod";
import {
  DEVICE_PLATFORMS,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_SUBJECT_MIN,
  SUPPORT_TICKET_KINDS,
  SUPPORT_TOPICS,
} from "@sayly/shared";


export const CreateSupportTicketRequestSchema = z
  .object({
    kind: z.enum(SUPPORT_TICKET_KINDS),
    topic: z.enum(SUPPORT_TOPICS).optional(),
    subject: z.string().min(SUPPORT_SUBJECT_MIN).max(SUPPORT_SUBJECT_MAX).meta({ example: "Dark mode for chat" }),
    message: z.string().min(SUPPORT_MESSAGE_MIN).max(SUPPORT_MESSAGE_MAX),
    device: z
      .object({
        appVersion: z.string().max(32).meta({ example: "1.0.0" }),
        platform: z.enum(DEVICE_PLATFORMS),
        osVersion: z.string().max(32).optional(),
        deviceModel: z.string().max(80).optional(),
      })
      .optional()
      .meta({ description: "Attached only when the member agrees" }),
  })
  .meta({ id: "CreateSupportTicketRequest", 
    description: "The sender and their reply email come from the session, never the body.",
  });

export const CreateFeedbackRequestSchema = CreateSupportTicketRequestSchema.omit({
  kind: true,
  topic: true,
}).meta({ id: "CreateFeedbackRequest",  description: "The route sets the kind." });

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
  .meta({ id: "SupportTicket" });

export const SupportTicketListSchema = z
  .object({ items: z.array(SupportTicketSchema) })
  .meta({ id: "SupportTicketList" });
