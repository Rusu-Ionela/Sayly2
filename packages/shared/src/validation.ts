import { z } from "zod";

import { sanitizeMultiline, sanitizeSingleLine } from "./text";

const hasNoNullByte = (value: string) => !value.includes("\u0000");

/** Sanitize first, then enforce length on what will actually be stored. */
export const singleLineTextSchema = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(sanitizeSingleLine)
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );

export const multilineTextSchema = (max: number, label: string) =>
  z
    .string()
    .transform(sanitizeMultiline)
    .pipe(z.string().max(max, `${label} must be at most ${max} characters`));

export const EMAIL_MAX_LENGTH = 254;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(EMAIL_MAX_LENGTH, "Email is too long")
  .email("Please provide a valid email address")
  .transform((value) => value.toLowerCase());

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const UPPERCASE = /[A-Z]/;
const DIGIT = /[0-9]/;
const SYMBOL = /[^A-Za-z0-9]/;

/** One entry per requirement; the app shows `label` as a checklist, the API returns `message`. */
export const PASSWORD_RULES = [
  {
    label: `Minimum ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: "At least one uppercase letter",
    message: "Password must include at least one uppercase letter",
    test: (value: string) => UPPERCASE.test(value),
  },
  {
    label: "At least one number",
    message: "Password must include at least one number",
    test: (value: string) => DIGIT.test(value),
  },
  {
    label: "At least one symbol character",
    message: "Password must include at least one symbol",
    test: (value: string) => SYMBOL.test(value),
  },
] as const;

const [lengthRule, uppercaseRule, digitRule, symbolRule] = PASSWORD_RULES;

/** Built from native checks (not refinements) so the API docs show the length and patterns. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, lengthRule.message)
  .max(PASSWORD_MAX_LENGTH, "Password is too long")
  .regex(UPPERCASE, uppercaseRule.message)
  .regex(DIGIT, digitRule.message)
  .regex(SYMBOL, symbolRule.message)
  .refine(hasNoNullByte, "Invalid characters");

export const currentPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(PASSWORD_MAX_LENGTH, "Password is too long")
  .refine(hasNoNullByte, "Invalid characters");

/** Password reset codes are 8 digits. */
export const RESET_CODE_PATTERN = /^\d{8}$/;
