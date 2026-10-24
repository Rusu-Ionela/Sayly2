import { z } from "zod";

export function rejectNullBytes(message = "Invalid characters") {
  return (value: string) => !value.includes("\u0000") || message;
}

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

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Please provide a valid email address")
  .transform((value) => value.toLowerCase());

export const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol")
  .refine((value) => !value.includes("\u0000"), "Invalid characters");

export const currentPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(128, "Password is too long")
  .refine((value) => !value.includes("\u0000"), "Invalid characters");

export const refreshTokenSchema = z
  .string()
  .min(16, "Refresh token is required")
  .max(256, "Refresh token is too long")
  .refine((value) => !value.includes("\u0000"), "Invalid token");

/** C0 controls + DEL, except tab/newline which multiline text keeps. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/**
 * Zero-width / bidi-override characters used for spoofing (e.g. a U+202E right-to-left
 * override that renders "Admin" from reversed text). ZWNJ/ZWJ (U+200C, U+200D) are kept —
 * emoji sequences and some scripts need them.
 */
const INVISIBLE_CHARS = /[\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Names, titles: NFC, no controls or invisible chars, single spaces. */
export function sanitizeSingleLine(value: string): string {
  return value
    .normalize("NFC")
    .replace(INVISIBLE_CHARS, "")
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bios, descriptions: like `sanitizeSingleLine` but keeps up to one blank line between paragraphs. */
export function sanitizeMultiline(value: string): string {
  return value
    .normalize("NFC")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
