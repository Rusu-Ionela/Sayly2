import type { OpenAPIRegistry, ResponseConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { bearerAuth, commonErrorResponses } from "../components/responses";
import {
  CertificateOffersSchema,
  ConversationTopicsSchema,
  CreateTopicRequestSchema,
  ExpressionsSchema,
  ProfileVisitsPageSchema,
} from "../schemas/profileDashboard.schemas";

const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
const topicIdParam = z.object({ topicId: z.string() });

function ok(description: string, schema: z.ZodTypeAny): Record<number, ResponseConfig> {
  return {
    200: { description, content: { "application/json": { schema } } },
    401: commonErrorResponses[401]!,
  };
}

/** Profile dashboard: Visitors, Topics, Sayly ID, certificates, expressions. */
export function registerProfileDashboardPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/profile-views/visitors",
    tags: ["Profile"],
    summary: "Who viewed your profile (list is Pro only)",
    security: bearerAuth,
    request: { query: pageQuery },
    responses: ok("Visitors", ProfileVisitsPageSchema),
  });

  registry.registerPath({
    method: "post",
    path: "/profile-views/visitors/seen",
    tags: ["Profile"],
    summary: "Reset the new-visitors counter (Pro only; no-op otherwise)",
    security: bearerAuth,
    responses: ok("Done", z.object({ ok: z.literal(true) })),
  });

  registry.registerPath({
    method: "get",
    path: "/profile-views/viewed",
    tags: ["Profile"],
    summary: "Profiles you viewed (list is Pro only)",
    security: bearerAuth,
    request: { query: pageQuery },
    responses: ok("Viewed profiles", ProfileVisitsPageSchema),
  });

  registry.registerPath({
    method: "get",
    path: "/topics",
    tags: ["Profile"],
    summary: "Your conversation topics (main topic first)",
    security: bearerAuth,
    responses: ok("Topics", ConversationTopicsSchema),
  });

  registry.registerPath({
    method: "post",
    path: "/topics",
    tags: ["Profile"],
    summary: "Create a topic (the first one becomes the main topic)",
    security: bearerAuth,
    request: {
      body: { required: true, content: { "application/json": { schema: CreateTopicRequestSchema } } },
    },
    responses: {
      201: { description: "Topics", content: { "application/json": { schema: ConversationTopicsSchema } } },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      409: commonErrorResponses[409]!,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/topics/{topicId}",
    tags: ["Profile"],
    summary: "Make a topic the main topic",
    security: bearerAuth,
    request: {
      params: topicIdParam,
      body: { required: true, content: { "application/json": { schema: z.object({ isMain: z.literal(true) }) } } },
    },
    responses: { ...ok("Topics", ConversationTopicsSchema), 404: commonErrorResponses[404]! },
  });

  registry.registerPath({
    method: "delete",
    path: "/topics/{topicId}",
    tags: ["Profile"],
    summary: "Delete a topic (deleting the main one promotes the newest)",
    security: bearerAuth,
    request: { params: topicIdParam },
    responses: { ...ok("Topics", ConversationTopicsSchema), 404: commonErrorResponses[404]! },
  });

  registry.registerPath({
    method: "get",
    path: "/users/by-sayly-id/{saylyId}",
    tags: ["Profile"],
    summary: "Resolve a shared Sayly ID (only while the owner shows it)",
    security: bearerAuth,
    request: { params: z.object({ saylyId: z.string().meta({ example: "K7QF3MZA" }) }) },
    responses: { ...ok("Member id", z.object({ userId: z.string() })), 404: commonErrorResponses[404]! },
  });

  registry.registerPath({
    method: "get",
    path: "/users/me/export",
    tags: ["Profile"],
    summary: "Download my data (JSON)",
    security: bearerAuth,
    responses: { ...ok("Data export", z.record(z.string(), z.unknown())), 429: commonErrorResponses[429]! },
  });

  registry.registerPath({
    method: "get",
    path: "/certificates/offers",
    tags: ["Profile"],
    summary: "Language test levels, format and pricing",
    security: bearerAuth,
    responses: ok("Offers", CertificateOffersSchema),
  });

  registry.registerPath({
    method: "get",
    path: "/learning/expressions",
    tags: ["Profile"],
    summary: "Curated idioms (defaults to the languages you learn)",
    security: bearerAuth,
    request: { query: z.object({ language: z.string().optional() }) },
    responses: ok("Expressions", ExpressionsSchema),
  });
}
