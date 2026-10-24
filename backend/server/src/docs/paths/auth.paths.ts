import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  SignupRequestSchema,
} from "../schemas/auth.schemas";
import { AuthResponseSchema, LogoutResponseSchema, MeResponseSchema } from "../schemas/user.schemas";
import { bearerAuth, commonErrorResponses } from "../components/responses";

export function registerAuthPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/auth/register",
    tags: ["Auth"],
    summary: "Register a new user",
    description:
      "Creates an account with email/password, hashes the password with Argon2, and returns access + refresh tokens.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: SignupRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Account created and authenticated",
        content: {
          "application/json": {
            schema: AuthResponseSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      409: commonErrorResponses[409]!,
      429: commonErrorResponses[429]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/login",
    tags: ["Auth"],
    summary: "Log in",
    description:
      "Authenticates with email and password. Failed attempts return a generic invalid-credentials error.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: LoginRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Authenticated",
        content: {
          "application/json": {
            schema: AuthResponseSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      429: commonErrorResponses[429]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/refresh",
    tags: ["Auth"],
    summary: "Refresh tokens",
    description:
      "Exchanges a valid refresh token for a new access/refresh pair. Previous refresh token is revoked (rotation). Reuse of a revoked token invalidates the token family.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: RefreshRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "New token pair issued",
        content: {
          "application/json": {
            schema: AuthResponseSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      429: commonErrorResponses[429]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/logout",
    tags: ["Auth"],
    summary: "Log out",
    description: "Revokes the provided refresh token. Always returns success to avoid token probing.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: LogoutRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Logged out",
        content: {
          "application/json": {
            schema: LogoutResponseSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      429: commonErrorResponses[429]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/me",
    tags: ["Auth"],
    summary: "Get current user",
    description: "Returns the authenticated user. Requires a valid Bearer access token.",
    security: bearerAuth,
    responses: {
      200: {
        description: "Current user",
        content: {
          "application/json": {
            schema: MeResponseSchema,
          },
        },
      },
      401: commonErrorResponses[401]!,
      429: commonErrorResponses[429]!,
      500: commonErrorResponses[500]!,
    },
  });
}
