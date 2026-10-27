import { z } from "zod";

export const boundedIdSchema = z
  .string()
  .trim()
  .min(1, "Id is required")
  .max(128, "Id is too long")
  .refine((value) => !value.includes("\u0000"), "Invalid id");

export const storedTextSchema = (min: number, max: number, message?: string) =>
  z
    .string()
    .min(min, message)
    .max(max, message ?? "Value is too long")
    .refine((value) => !value.includes("\u0000"), "Invalid characters");

export const refreshTokenSchema = z
  .string()
  .min(16, "Refresh token is required")
  .max(256, "Refresh token is too long")
  .refine((value) => !value.includes("\u0000"), "Invalid token");
