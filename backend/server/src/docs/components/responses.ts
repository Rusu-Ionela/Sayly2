import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";

import {
  ConflictErrorSchema,
  ErrorResponseSchema,
  RateLimitErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
  NotFoundErrorSchema,
} from "../schemas/error.schemas";

export const commonErrorResponses: Record<string, ResponseConfig> = {
  400: {
    description: "Validation error",
    content: {
      "application/json": {
        schema: ValidationErrorSchema,
      },
    },
  },
  401: {
    description: "Unauthorized",
    content: {
      "application/json": {
        schema: UnauthorizedErrorSchema,
      },
    },
  },
  404: {
    description: "Resource not found",
    content: {
      "application/json": {
        schema: NotFoundErrorSchema,
      },
    },
  },
  409: {
    description: "Conflict",
    content: {
      "application/json": {
        schema: ConflictErrorSchema,
      },
    },
  },
  429: {
    description: "Too many requests",
    content: {
      "application/json": {
        schema: RateLimitErrorSchema,
      },
    },
  },
  500: {
    description: "Internal server error",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
      },
    },
  },
};

export const bearerAuth = [{ bearerAuth: [] }];
