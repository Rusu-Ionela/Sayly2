import { z } from "zod";

export const ErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      fields: z.record(z.string(), z.string()).optional(),
    }),
  })
  .meta({ id: "ErrorResponse" });

export const ValidationErrorSchema = ErrorResponseSchema.meta({ id: "ValidationError" });
export const UnauthorizedErrorSchema = ErrorResponseSchema.meta({ id: "UnauthorizedError" });
export const ForbiddenErrorSchema = ErrorResponseSchema.meta({ id: "ForbiddenError" });
export const NotFoundErrorSchema = ErrorResponseSchema.meta({ id: "NotFoundError" });
export const RateLimitErrorSchema = ErrorResponseSchema.meta({ id: "RateLimitError" });
export const ConflictErrorSchema = ErrorResponseSchema.meta({ id: "ConflictError" });
