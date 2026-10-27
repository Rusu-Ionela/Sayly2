/** C0 controls + DEL, except tab/newline which multiline text keeps. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/**
 * Zero-width / bidi-override characters used for spoofing (e.g. a U+202E right-to-left
 * override that renders "Admin" from reversed text). ZWNJ/ZWJ (U+200C, U+200D) are kept —
 * emoji sequences and some scripts need them.
 */
const INVISIBLE_CHARS = /[​‎‏‪-‮⁦-⁩﻿]/g;

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
