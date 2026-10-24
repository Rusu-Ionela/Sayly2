import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { bearerAuth, commonErrorResponses } from "../components/responses";
import {
  CreateFeedbackRequestSchema,
  CreateSupportTicketRequestSchema,
  SupportTicketListSchema,
  SupportTicketSchema,
} from "../schemas/support.schemas";

/** Contact us, feature requests and bug reports. */
export function registerSupportPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/support/tickets",
    tags: ["Support"],
    summary: "Contact support, request a feature or report a bug",
    security: bearerAuth,
    request: {
      body: { content: { "application/json": { schema: CreateSupportTicketRequestSchema } } },
    },
    responses: {
      201: {
        description: "Saved",
        content: { "application/json": { schema: SupportTicketSchema } },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      429: commonErrorResponses[429]!,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/support/tickets",
    tags: ["Support"],
    summary: "What you sent to support (newest first)",
    security: bearerAuth,
    responses: {
      200: {
        description: "Your tickets",
        content: { "application/json": { schema: SupportTicketListSchema } },
      },
      401: commonErrorResponses[401]!,
    },
  });

  for (const [path, summary] of [
    ["/support/bug-report", "Report a bug"],
    ["/support/feature-request", "Request a feature"],
  ] as const) {
    registry.registerPath({
      method: "post",
      path,
      tags: ["Support"],
      summary,
      security: bearerAuth,
      request: {
        body: { content: { "application/json": { schema: CreateFeedbackRequestSchema } } },
      },
      responses: {
        201: {
          description: "Saved",
          content: { "application/json": { schema: SupportTicketSchema } },
        },
        400: commonErrorResponses[400]!,
        401: commonErrorResponses[401]!,
        429: commonErrorResponses[429]!,
      },
    });
  }
}
