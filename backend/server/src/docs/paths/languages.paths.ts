import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { bearerAuth, commonErrorResponses } from "../components/responses";
import {
  LanguageSchema,
  SyncUserLanguagesRequestSchema,
  UserLanguagesGroupedSchema,
} from "../schemas/language.schemas";

export function registerLanguagePaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/languages",
    tags: ["Languages"],
    summary: "List supported languages",
    description:
      "Returns the predefined language catalog (ISO-639-1 code, name, flag). Cached in memory because it is read often and changes rarely.",
    responses: {
      200: {
        description: "Language catalog",
        content: {
          "application/json": {
            schema: z.array(LanguageSchema),
          },
        },
      },
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/users/me/languages",
    tags: ["Languages"],
    summary: "Get current user's languages",
    description: "Returns the authenticated user's languages grouped by SPEAKS and LEARNING.",
    security: bearerAuth,
    responses: {
      200: {
        description: "User languages grouped by type",
        content: {
          "application/json": {
            schema: UserLanguagesGroupedSchema,
          },
        },
      },
      401: commonErrorResponses[401]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "put",
    path: "/users/me/languages",
    tags: ["Languages"],
    summary: "Replace current user's languages",
    description:
      "Atomically replaces the authenticated user's spoken and learning languages. Max 5 learning languages. A language cannot be both spoken and learning.",
    security: bearerAuth,
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: SyncUserLanguagesRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated languages grouped by type",
        content: {
          "application/json": {
            schema: UserLanguagesGroupedSchema,
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
