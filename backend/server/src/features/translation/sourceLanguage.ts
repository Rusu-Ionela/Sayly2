import { detect } from "tinyld";

import { AppError } from "../../shared/errors/AppError";
import { normalizeLanguageCode } from "../languages/catalog";
import { getMyLanguages } from "../languages/service";

/**
 * Languages the author may have written in, most likely first: native, other spoken, then
 * the ones they are learning. In a language exchange a message is almost always in one of them.
 */
export async function authorLanguages(authorId: string): Promise<string[]> {
  const grouped = await getMyLanguages(authorId);
  const ordered = [
    ...grouped.SPEAKS.filter((item) => item.proficiency === "NATIVE"),
    ...grouped.SPEAKS.filter((item) => item.proficiency !== "NATIVE"),
    ...grouped.LEARNING,
  ];
  const codes = ordered
    .map((item) => normalizeLanguageCode(item.code))
    .filter((code): code is string => code !== null);
  return [...new Set(codes)];
}

/**
 * Picks the language a text is written in, never leaving it to the translation service to guess
 * (free services mistake short texts: "salut" detected as Catalan came back as "health").
 * `candidates` are the author's languages, most likely first.
 */
export function pickSourceLanguage(text: string, candidates: string[], target: string): string {
  const possible = candidates.filter((code) => code !== target);
  const alreadyTarget = () =>
    new AppError("This message already seems to be in your language", 400, "VALIDATION_ERROR");

  // Restricting detection to the author's languages (plus yours, to notice a message that needs
  // no translation) makes it reliable for real sentences. An author whose profile lists only
  // your language may still write in another one, so then detection is unrestricted.
  const pool = possible.length > 0 ? [...possible, target] : undefined;
  const detected = normalizeLanguageCode(detect(text, pool ? { only: pool } : undefined) || "");
  if (detected === target) throw alreadyTarget();
  if (detected && (!pool || possible.includes(detected))) return detected;

  // One word ("salut", "ok") is too short to detect: assume the author's most likely language.
  if (possible[0]) return possible[0];
  throw alreadyTarget();
}

export async function resolveSourceLanguage(
  text: string,
  authorId: string,
  target: string,
): Promise<string> {
  return pickSourceLanguage(text, await authorLanguages(authorId), target);
}
