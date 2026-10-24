import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

import { env } from "../config/env";
import { registerAuthPaths } from "./paths/auth.paths";
import { registerFollowPaths } from "./paths/follows.paths";
import { registerReferencePaths } from "./paths/references.paths";
import { registerChatPaths } from "./paths/chat.paths";
import { registerDiscoveryPaths } from "./paths/discovery.paths";
import { registerGroupPaths } from "./paths/groups.paths";
import { registerLanguagePaths } from "./paths/languages.paths";
import { registerProfileDashboardPaths } from "./paths/profileDashboard.paths";
import { registerSupportPaths } from "./paths/support.paths";
import {
  ConflictErrorSchema,
  ErrorResponseSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  RateLimitErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from "./schemas/error.schemas";
import { AuthResponseSchema, LogoutResponseSchema, MeResponseSchema, UserSchema } from "./schemas/user.schemas";
import {
  DiscoverLanguageSchema,
  DiscoverPageMetaSchema,
  DiscoverPageSchema,
  DiscoverPublicLanguageSchema,
  DiscoverPublicProfileSchema,
  DiscoverQueryOpenApiSchema,
  DiscoverUserSchema,
} from "./schemas/discovery.schemas";
import {
  ChatMessageSchema,
  ChatPartnerSchema,
  ConversationListItemSchema,
  ConversationsPageSchema,
  MarkReadResponseSchema,
  MessagesPageSchema,
  SendMessageRequestSchema,
} from "./schemas/chat.schemas";
import {
  LanguageSchema,
  SyncUserLanguagesRequestSchema,
  UserLanguageItemSchema,
  UserLanguagesGroupedSchema,
} from "./schemas/language.schemas";
import {
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  SignupRequestSchema,
} from "./schemas/auth.schemas";

extendZodWithOpenApi(z);

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Short-lived JWT access token from /auth/login or /auth/register",
  });

  registry.register("User", UserSchema);
  registry.register("AuthResponse", AuthResponseSchema);
  registry.register("MeResponse", MeResponseSchema);
  registry.register("LogoutResponse", LogoutResponseSchema);
  registry.register("SignupRequest", SignupRequestSchema);
  registry.register("LoginRequest", LoginRequestSchema);
  registry.register("RefreshRequest", RefreshRequestSchema);
  registry.register("LogoutRequest", LogoutRequestSchema);
  registry.register("ErrorResponse", ErrorResponseSchema);
  registry.register("ValidationError", ValidationErrorSchema);
  registry.register("UnauthorizedError", UnauthorizedErrorSchema);
  registry.register("ForbiddenError", ForbiddenErrorSchema);
  registry.register("NotFoundError", NotFoundErrorSchema);
  registry.register("RateLimitError", RateLimitErrorSchema);
  registry.register("ConflictError", ConflictErrorSchema);

  registry.register("Language", LanguageSchema);
  registry.register("UserLanguageItem", UserLanguageItemSchema);
  registry.register("UserLanguagesGrouped", UserLanguagesGroupedSchema);
  registry.register("SyncUserLanguagesRequest", SyncUserLanguagesRequestSchema);
  registry.register("DiscoverLanguage", DiscoverLanguageSchema);
  registry.register("DiscoverUser", DiscoverUserSchema);
  registry.register("DiscoverPageMeta", DiscoverPageMetaSchema);
  registry.register("DiscoverPage", DiscoverPageSchema);
  registry.register("DiscoverPublicLanguage", DiscoverPublicLanguageSchema);
  registry.register("DiscoverPublicProfile", DiscoverPublicProfileSchema);
  registry.register("DiscoverQuery", DiscoverQueryOpenApiSchema);
  registry.register("ChatMessage", ChatMessageSchema);
  registry.register("ChatPartner", ChatPartnerSchema);
  registry.register("ConversationListItem", ConversationListItemSchema);
  registry.register("ConversationsPage", ConversationsPageSchema);
  registry.register("MessagesPage", MessagesPageSchema);
  registry.register("SendMessageRequest", SendMessageRequestSchema);
  registry.register("MarkReadResponse", MarkReadResponseSchema);

  registerAuthPaths(registry);
  registerLanguagePaths(registry);
  registerDiscoveryPaths(registry);
  registerGroupPaths(registry);
  registerChatPaths(registry);
  registerProfileDashboardPaths(registry);
  registerSupportPaths(registry);
  registerFollowPaths(registry);
  registerReferencePaths(registry);

  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Sayly API",
      version: "1.0.0",
      description:
        "Language exchange API. Authentication uses short-lived JWT access tokens and rotating opaque refresh tokens (Bearer). Cookie/CSRF is not used because the primary client is a mobile app.",
    },
    servers: [
      {
        url: `http://localhost:${env.port}`,
        description: "Local development",
      },
      {
        url: "/",
        description: "Current host",
      },
    ],
    tags: [
      {
        name: "Auth",
        description: "Registration, login, session refresh, and current user",
      },
      {
        name: "Languages",
        description: "Language catalog and the authenticated user's spoken/learning languages",
      },
      {
        name: "Discovery",
        description:
          "Recommended partners, search, filters, paginated match scoring, and public profile from discovery",
      },
      {
        name: "References",
        description: "Short public notes about a language partner",
      },
      {
        name: "Follows",
        description: "Follow partners and list who you follow",
      },
      {
        name: "Chat",
        description: "Conversation inbox, one-to-one message history, and HTTP send/read fallbacks",
      },
    ],
  });
}

export function mountOpenApi(app: Express) {
  if (!env.enableSwagger) {
    return;
  }

  const document = buildOpenApiDocument();
  const path = env.swaggerPath.replace(/\/$/, "") || "/api-docs";

  app.get(`${path}/openapi.json`, (_req, res) => {
    res.json(document);
  });

  app.use(path, swaggerUi.serve, swaggerUi.setup(document, {
    explorer: true,
    customSiteTitle: "Sayly API Docs",
  }));
}
