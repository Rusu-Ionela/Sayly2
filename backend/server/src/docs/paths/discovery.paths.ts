import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { bearerAuth, commonErrorResponses } from "../components/responses";
import {
  DiscoverPageSchema,
  DiscoverPublicProfileSchema,
  DiscoverQueryOpenApiSchema,
} from "../schemas/discovery.schemas";

const discoverDescription =
  "Authenticated partner discovery (DISC-001 / DISC-002 / DISC-003 / DISC-004 / DISC-005). " +
  "Excludes the current user, inactive/incomplete profiles, and bidirectional blocks. " +
  "Returns a paginated payload with `items` and `meta`, sorted by deterministic matchScore DESC.";

export function registerDiscoveryPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/discover",
    tags: ["Discovery"],
    summary: "Discover language partners",
    description: discoverDescription,
    security: bearerAuth,
    request: {
      query: DiscoverQueryOpenApiSchema,
    },
    responses: {
      200: {
        description: "Paginated public discovery cards",
        content: {
          "application/json": {
            schema: DiscoverPageSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/discover/users/{id}",
    tags: ["Discovery"],
    summary: "Open a partner's public profile from discovery",
    description:
      "DISC-006. Authenticated alias of GET /users/:id/public-profile. " +
      "Returns public profile fields, languages with proficiency, practice goals, " +
      "and conversationId when you already chat with them.",
    security: bearerAuth,
    request: {
      params: z.object({
        id: z.string().openapi({ example: "clxyz...", description: "Target user id" }),
      }),
    },
    responses: {
      200: {
        description: "Safe public profile",
        content: {
          "application/json": {
            schema: DiscoverPublicProfileSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/users/{id}/public-profile",
    tags: ["Discovery"],
    summary: "Get a user's public profile",
    description:
      "DISC-006 / PRO-001. Authenticated public profile used when opening a partner from discovery. " +
      "Same payload as GET /discover/users/:id.",
    security: bearerAuth,
    request: {
      params: z.object({
        id: z.string().openapi({ example: "clxyz...", description: "Target user id" }),
      }),
    },
    responses: {
      200: {
        description: "Safe public profile",
        content: {
          "application/json": {
            schema: DiscoverPublicProfileSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });
}
