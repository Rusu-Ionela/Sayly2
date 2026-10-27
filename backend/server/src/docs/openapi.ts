import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import type { Express } from "express";
import type { ZodType } from "zod";
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

/**
 * Always-listed component schemas. Zod 4 builds methods when a schema type is first created, so
 * the `.openapi()` that `registry.register` relies on is missing on schemas made before
 * `extendZodWithOpenApi`. Naming them with Zod's own `.meta({ id })` avoids that ordering trap.
 */
type OpenAPIDefinition = OpenAPIRegistry["definitions"][number];

function namedComponents(schemas: Record<string, ZodType>): OpenAPIDefinition[] {
  return Object.entries(schemas).map(([id, schema]) => ({
    type: "schema",
    schema: schema.meta({ ...schema.meta(), id }),
  }));
}

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Short-lived JWT access token from /auth/login or /auth/register",
  });

  registerAuthPaths(registry);
  registerLanguagePaths(registry);
  registerDiscoveryPaths(registry);
  registerGroupPaths(registry);
  registerChatPaths(registry);
  registerProfileDashboardPaths(registry);
  registerSupportPaths(registry);
  registerFollowPaths(registry);
  registerReferencePaths(registry);

  const generator = new OpenApiGeneratorV31([
    ...registry.definitions,
    ...namedComponents({
    User: UserSchema,
    AuthResponse: AuthResponseSchema,
    MeResponse: MeResponseSchema,
    LogoutResponse: LogoutResponseSchema,
    SignupRequest: SignupRequestSchema,
    LoginRequest: LoginRequestSchema,
    RefreshRequest: RefreshRequestSchema,
    LogoutRequest: LogoutRequestSchema,
    ErrorResponse: ErrorResponseSchema,
    ValidationError: ValidationErrorSchema,
    UnauthorizedError: UnauthorizedErrorSchema,
    ForbiddenError: ForbiddenErrorSchema,
    NotFoundError: NotFoundErrorSchema,
    RateLimitError: RateLimitErrorSchema,
    ConflictError: ConflictErrorSchema,
    Language: LanguageSchema,
    UserLanguageItem: UserLanguageItemSchema,
    UserLanguagesGrouped: UserLanguagesGroupedSchema,
    SyncUserLanguagesRequest: SyncUserLanguagesRequestSchema,
    DiscoverLanguage: DiscoverLanguageSchema,
    DiscoverUser: DiscoverUserSchema,
    DiscoverPageMeta: DiscoverPageMetaSchema,
    DiscoverPage: DiscoverPageSchema,
    DiscoverPublicLanguage: DiscoverPublicLanguageSchema,
    DiscoverPublicProfile: DiscoverPublicProfileSchema,
    DiscoverQuery: DiscoverQueryOpenApiSchema,
    ChatMessage: ChatMessageSchema,
    ChatPartner: ChatPartnerSchema,
    ConversationListItem: ConversationListItemSchema,
    ConversationsPage: ConversationsPageSchema,
    MessagesPage: MessagesPageSchema,
    SendMessageRequest: SendMessageRequestSchema,
    MarkReadResponse: MarkReadResponseSchema,
    }),
  ]);

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
