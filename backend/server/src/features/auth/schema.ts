import { z } from "zod";
import {
  currentPasswordSchema,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  emailSchema,
  newPasswordSchema,
} from "@sayly/shared";

import { refreshTokenSchema } from "../../shared/validation/text";

export const registerSchema = z
  .object({
    email: emailSchema.meta({ example: "learner@example.com" }),
    password: newPasswordSchema.meta({ example: "SecurePass1!" }),
    displayName: z
      .string()
      .trim()
      .min(DISPLAY_NAME_MIN, `Display name must be at least ${DISPLAY_NAME_MIN} characters`)
      .max(DISPLAY_NAME_MAX, "Display name is too long")
      .refine((value) => !value.includes("\u0000"), "Invalid characters")
      .meta({ example: "Aryan" }),
  })
  .strict()
  .meta({ id: "SignupRequest" });

export const loginSchema = z
  .object({
    email: emailSchema.meta({ example: "learner@example.com" }),
    password: currentPasswordSchema.meta({ example: "SecurePass1" }),
  })
  .strict()
  .meta({ id: "LoginRequest" });

export const refreshSchema = z
  .object({
    refreshToken: refreshTokenSchema,
  })
  .strict()
  .meta({ id: "RefreshRequest" });

export const logoutSchema = z
  .object({
    refreshToken: refreshTokenSchema,
  })
  .strict()
  .meta({ id: "LogoutRequest" });

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
  .meta({ id: "ResetPasswordRequest" });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
