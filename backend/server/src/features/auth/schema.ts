import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  currentPasswordSchema,
  emailSchema,
  newPasswordSchema,
  refreshTokenSchema,
} from "../../shared/validation/text";

extendZodWithOpenApi(z);

export const registerSchema = z
  .object({
    email: emailSchema.openapi({ example: "learner@example.com" }),
    password: newPasswordSchema.openapi({ example: "SecurePass1!" }),
    displayName: z
      .string()
      .trim()
      .min(2, "Display name must be at least 2 characters")
      .max(50, "Display name is too long")
      .refine((value) => !value.includes("\u0000"), "Invalid characters")
      .openapi({ example: "Aryan" }),
  })
  .strict()
  .openapi("SignupRequest");

export const loginSchema = z
  .object({
    email: emailSchema.openapi({ example: "learner@example.com" }),
    password: currentPasswordSchema.openapi({ example: "SecurePass1" }),
  })
  .strict()
  .openapi("LoginRequest");

export const refreshSchema = z
  .object({
    refreshToken: refreshTokenSchema,
  })
  .strict()
  .openapi("RefreshRequest");

export const logoutSchema = z
  .object({
    refreshToken: refreshTokenSchema,
  })
  .strict()
  .openapi("LogoutRequest");

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    challengeId: z
      .string()
      .trim()
      .min(16, "Reset challenge is required")
      .max(128, "Reset challenge is too long"),
    token: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "Reset code must be an 8-digit number"),
    password: newPasswordSchema,
  })
  .strict()
  .openapi("ResetPasswordRequest");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
