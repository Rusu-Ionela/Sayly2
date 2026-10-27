import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { bearerAuth, commonErrorResponses } from "../components/responses";
import { MemberSummarySchema } from "../schemas/profileDashboard.schemas";

const userIdParams = z.object({
  userId: z.string().meta({ example: "clxyz...", description: "User to follow or unfollow" }),
});
const followState = z.object({ following: z.boolean() });

export function registerFollowPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "put",
    path: "/follows/{userId}",
    tags: ["Follows"],
    summary: "Follow a user",
    description:
      "Idempotent. 404 when the user is unavailable or blocked either way; 400 when following yourself.",
    security: bearerAuth,
    request: { params: userIdParams },
    responses: {
      200: { description: "Now following", content: { "application/json": { schema: followState } } },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/follows/{userId}",
    tags: ["Follows"],
    summary: "Unfollow a user",
    description: "Idempotent.",
    security: bearerAuth,
    request: { params: userIdParams },
    responses: {
      200: { description: "No longer following", content: { "application/json": { schema: followState } } },
      401: commonErrorResponses[401]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/follows",
    tags: ["Follows"],
    summary: "List people you follow",
    description: "Newest first, 30 per page. Hides inactive and blocked users.",
    security: bearerAuth,
    request: { query: z.object({ page: z.coerce.number().int().min(1).optional() }) },
    responses: {
      200: {
        description: "Page of followed users",
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(
                MemberSummarySchema.extend({ followedAt: z.string() }),
              ),
              page: z.number().int(),
              hasMore: z.boolean(),
            }),
          },
        },
      },
      401: commonErrorResponses[401]!,
      500: commonErrorResponses[500]!,
    },
  });
}
