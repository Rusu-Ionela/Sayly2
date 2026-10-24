import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  RATING_MAX,
  RATING_MIN,
  REFERENCE_BODY_MAX,
  REFERENCES_PAGE_SIZE,
} from "../../features/references/types";
import { bearerAuth, commonErrorResponses } from "../components/responses";
import { ErrorResponseSchema } from "../schemas/error.schemas";

const userIdParams = z.object({
  userId: z.string().openapi({ example: "clxyz...", description: "The person the references are about" }),
});
const rating = z.number().int().min(RATING_MIN).max(RATING_MAX);
const myReference = z
  .object({ id: z.string(), rating, body: z.string(), createdAt: z.string() })
  .openapi("MyReference");
const reference = myReference
  .extend({
    author: z.object({ id: z.string(), displayName: z.string(), avatarUrl: z.string().nullable() }),
  })
  .openapi("Reference");
export const ReferenceSummarySchema = z
  .object({
    total: z.number().int(),
    positive: z.number().int().openapi({ description: "Rated 4 or 5" }),
  })
  .openapi("ReferenceSummary");

/** References language partners leave on each other's profiles. */
export function registerReferencePaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/users/{userId}/references",
    tags: ["References"],
    summary: "A member's references",
    description:
      `Newest first, ${REFERENCES_PAGE_SIZE} per page, plus a summary (total / positive). Hides authors who are ` +
      "inactive or blocked either way. canWrite is true when the viewer has exchanged messages with the member " +
      "(or already wrote one); mine is the viewer's own reference, if any.",
    security: bearerAuth,
    request: { params: userIdParams, query: z.object({ page: z.coerce.number().int().min(1).optional() }) },
    responses: {
      200: {
        description: "Page of references",
        content: {
          "application/json": {
            schema: z
              .object({
                summary: ReferenceSummarySchema,
                items: z.array(reference),
                page: z.number().int(),
                hasMore: z.boolean(),
                canWrite: z.boolean(),
                mine: myReference.nullable(),
              })
              .openapi("ReferencesPage"),
          },
        },
      },
      401: commonErrorResponses[401]!,
      404: commonErrorResponses[404]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/users/{userId}/references",
    tags: ["References"],
    summary: "Write or replace your reference for a member",
    description:
      "One reference per author and member; posting again replaces it. 403 unless both of you have sent a " +
      "message in your chat. 404 for unavailable or blocking members.",
    security: bearerAuth,
    request: {
      params: userIdParams,
      body: {
        content: {
          "application/json": {
            schema: z.object({ rating, body: z.string().min(1).max(REFERENCE_BODY_MAX) }),
          },
        },
      },
    },
    responses: {
      201: { description: "Saved", content: { "application/json": { schema: myReference } } },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      403: {
        description: "You haven't chatted with this member yet",
        content: { "application/json": { schema: ErrorResponseSchema } },
      },
      404: commonErrorResponses[404]!,
      429: commonErrorResponses[429]!,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/users/{userId}/references",
    tags: ["References"],
    summary: "Delete your reference for a member",
    description: "Idempotent.",
    security: bearerAuth,
    request: { params: userIdParams },
    responses: {
      200: {
        description: "Deleted",
        content: { "application/json": { schema: z.object({ deleted: z.literal(true) }) } },
      },
      401: commonErrorResponses[401]!,
    },
  });
}
