import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const ErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      fields: z.record(z.string()).optional(),
    }),
  })
  .openapi("ErrorResponse");

export const ValidationErrorSchema = ErrorResponseSchema.openapi("ValidationError");
export const UnauthorizedErrorSchema = ErrorResponseSchema.openapi("UnauthorizedError");
export const ForbiddenErrorSchema = ErrorResponseSchema.openapi("ForbiddenError");
export const NotFoundErrorSchema = ErrorResponseSchema.openapi("NotFoundError");
export const RateLimitErrorSchema = ErrorResponseSchema.openapi("RateLimitError");
export const ConflictErrorSchema = ErrorResponseSchema.openapi("ConflictError");
